package monitor

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/yourusername/bjishk/internal/database"
	"github.com/yourusername/bjishk/pkg/models"
)

type CheckResult struct {
	Status       string
	ResponseTime int
	Title        string
	Error        string
}

type Monitor struct {
	db     *database.DB
	config MonitorConfig
	timers map[uint]*time.Ticker
	mu     sync.RWMutex
	wg     sync.WaitGroup
	quit   chan struct{}
}

type MonitorConfig struct {
	Retries    int
	RetryDelay int
	Timeout    int
}

func New(db *database.DB, config MonitorConfig) *Monitor {
	return &Monitor{
		db:     db,
		config: config,
		timers: make(map[uint]*time.Ticker),
		quit:   make(chan struct{}),
	}
}

func (m *Monitor) CheckService(service *models.Service) *CheckResult {
	client := &http.Client{
		Timeout: time.Duration(10) * time.Second,
	}

	for attempt := 0; attempt <= m.config.Retries; attempt++ {
		start := time.Now()

		req, err := http.NewRequest("GET", service.URL, nil)
		if err != nil {
			if attempt < m.config.Retries {
				time.Sleep(time.Duration(m.config.RetryDelay) * time.Second)
				continue
			}
			return &CheckResult{
				Status: "down",
				Error:  fmt.Sprintf("Failed to create request: %v", err),
			}
		}

		req.Header.Set("User-Agent", "Bjishk Health Monitor/1.0")

		resp, err := client.Do(req)
		if err != nil {
			if attempt < m.config.Retries {
				time.Sleep(time.Duration(m.config.RetryDelay) * time.Second)
				continue
			}
			return &CheckResult{
				Status: "down",
				Error:  fmt.Sprintf("Request failed: %v", err),
			}
		}

		responseTime := int(time.Since(start).Milliseconds())

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			var title string
			contentType := resp.Header.Get("Content-Type")

			if regexp.MustCompile(`text/html`).MatchString(contentType) {
				body, err := io.ReadAll(resp.Body)
				resp.Body.Close()
				if err == nil {
					titleRegex := regexp.MustCompile(`<title[^>]*>([^<]+)</title>`)
					matches := titleRegex.FindSubmatch(body)
					if len(matches) > 1 {
						title = string(matches[1])
					}
				}
			} else {
				resp.Body.Close()
			}

			return &CheckResult{
				Status:       "up",
				ResponseTime: responseTime,
				Title:        title,
			}
		}

		resp.Body.Close()

		if attempt < m.config.Retries {
			time.Sleep(time.Duration(m.config.RetryDelay) * time.Second)
			continue
		}

		return &CheckResult{
			Status: "down",
			Error:  fmt.Sprintf("HTTP %d %s", resp.StatusCode, resp.Status),
		}
	}

	return &CheckResult{
		Status: "down",
		Error:  "All retries failed",
	}
}

func (m *Monitor) PerformCheck(service *models.Service) {
	fmt.Printf("🔍 Checking service: %s\n", service.URL)

	result := m.CheckService(service)
	now := time.Now()

	previousStatus := service.Status
	newStatus := result.Status

	consecutiveFailures := 0
	if newStatus == "down" {
		consecutiveFailures = service.ConsecutiveFailures + 1
	}

	updateData := map[string]interface{}{
		"last_check":           now,
		"status":               newStatus,
		"consecutive_failures": consecutiveFailures,
	}

	if result.ResponseTime > 0 {
		updateData["response_time"] = result.ResponseTime
	}

	if service.Name == nil && result.Title != "" {
		updateData["name"] = result.Title
	}

	serviceID := int(service.ID)
	if err := m.db.UpdateService(serviceID, updateData); err != nil {
		fmt.Printf("   ❌ Failed to update service: %v\n", err)
		return
	}

	// Log the check
	var message *string
	if result.Error != "" {
		message = &result.Error
	}
	var responseTime *int
	if result.ResponseTime > 0 {
		responseTime = &result.ResponseTime
	}

	if err := m.db.AddLog(&serviceID, nil, newStatus, responseTime, message); err != nil {
		fmt.Printf("   ⚠️  Failed to add log: %v\n", err)
	}

	// Status change notification
	if previousStatus != newStatus && newStatus == "down" && consecutiveFailures >= 3 {
		msg := fmt.Sprintf("Service %s is DOWN (%d consecutive failures). Error: %s",
			service.URL, consecutiveFailures, result.Error)
		if _, err := m.db.AddNotification(&serviceID, nil, msg); err != nil {
			fmt.Printf("   ⚠️  Failed to create notification: %v\n", err)
		}
	} else if previousStatus != newStatus && newStatus == "up" {
		msg := fmt.Sprintf("Service %s is back UP (response time: %dms)", service.URL, result.ResponseTime)
		if _, err := m.db.AddNotification(&serviceID, nil, msg); err != nil {
			fmt.Printf("   ⚠️  Failed to create notification: %v\n", err)
		}
	}

	if newStatus == "up" {
		fmt.Printf("   ✅ UP (%dms)\n", result.ResponseTime)
	} else {
		fmt.Printf("   ❌ DOWN: %s\n", result.Error)
	}
}

func (m *Monitor) StartMonitoring(service *models.Service) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Stop existing timer if any
	if ticker, exists := m.timers[service.ID]; exists {
		ticker.Stop()
	}

	interval := time.Duration(service.CheckInterval) * time.Second
	ticker := time.NewTicker(interval)
	m.timers[service.ID] = ticker

	m.wg.Add(1)
	go func(svc *models.Service) {
		defer m.wg.Done()

		// Perform initial check
		m.PerformCheck(svc)

		for {
			select {
			case <-ticker.C:
				// Refresh service data
				refreshed, err := m.db.GetService(int(svc.ID))
				if err != nil {
					fmt.Printf("Failed to refresh service %d: %v\n", svc.ID, err)
					continue
				}
				if refreshed != nil {
					m.PerformCheck(refreshed)
				}
			case <-m.quit:
				return
			}
		}
	}(service)
}

func (m *Monitor) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	close(m.quit)

	for _, ticker := range m.timers {
		ticker.Stop()
	}

	m.wg.Wait()
	fmt.Println("🛑 All monitors stopped")
}
