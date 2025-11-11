package federation

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/yourusername/bjishk/internal/database"
	"github.com/yourusername/bjishk/pkg/models"
)

type HealthResponse struct {
	Status            string `json:"status"`
	InstanceName      string `json:"instance_name"`
	Uptime            int64  `json:"uptime"`
	ServicesMonitored int    `json:"services_monitored"`
	ServicesUp        int    `json:"services_up"`
	ServicesDown      int    `json:"services_down"`
	Timestamp         string `json:"timestamp"`
}

type Service struct {
	db        *database.DB
	config    FederationConfig
	startTime time.Time
	ticker    *time.Ticker
	quit      chan struct{}
	wg        sync.WaitGroup
}

type FederationConfig struct {
	Retries         int
	RetryDelay      int
	PeerCheckInterval int
}

func New(db *database.DB, config FederationConfig) *Service {
	return &Service{
		db:        db,
		config:    config,
		startTime: time.Now(),
		quit:      make(chan struct{}),
	}
}

func (s *Service) CheckPeer(peer *models.Peer) (string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	for attempt := 0; attempt <= s.config.Retries; attempt++ {
		healthURL := fmt.Sprintf("%s/api/health", peer.URL)

		req, err := http.NewRequest("GET", healthURL, nil)
		if err != nil {
			if attempt < s.config.Retries {
				time.Sleep(time.Duration(s.config.RetryDelay) * time.Second)
				continue
			}
			return "down", err
		}

		req.Header.Set("User-Agent", "Bjishk Federation/1.0")

		resp, err := client.Do(req)
		if err != nil {
			if attempt < s.config.Retries {
				time.Sleep(time.Duration(s.config.RetryDelay) * time.Second)
				continue
			}
			return "down", err
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			var health HealthResponse
			if err := json.NewDecoder(resp.Body).Decode(&health); err == nil {
				if health.Status == "ok" {
					return "up", nil
				}
				return "down", fmt.Errorf("health check returned error status")
			}
			return "up", nil
		}

		if attempt < s.config.Retries {
			time.Sleep(time.Duration(s.config.RetryDelay) * time.Second)
			continue
		}

		return "down", fmt.Errorf("HTTP %d %s", resp.StatusCode, resp.Status)
	}

	return "down", fmt.Errorf("all retries failed")
}

func (s *Service) PerformPeerCheck(peer *models.Peer) {
	fmt.Printf("🔍 Checking peer: %s\n", peer.URL)

	status, err := s.CheckPeer(peer)
	now := time.Now()

	previousStatus := peer.Status
	consecutiveFailures := 0
	if status == "down" {
		consecutiveFailures = peer.ConsecutiveFailures + 1
	}

	updateData := map[string]interface{}{
		"last_check":           now,
		"status":               status,
		"consecutive_failures": consecutiveFailures,
	}

	peerID := int(peer.ID)
	if err := s.db.UpdatePeer(peerID, updateData); err != nil {
		fmt.Printf("   ❌ Failed to update peer: %v\n", err)
		return
	}

	// Log the check
	var message *string
	if err != nil {
		msg := err.Error()
		message = &msg
	}

	if err := s.db.AddLog(nil, &peerID, status, nil, message); err != nil {
		fmt.Printf("   ⚠️  Failed to add log: %v\n", err)
	}

	// Notifications
	if previousStatus != status && status == "down" && consecutiveFailures >= 3 {
		msg := fmt.Sprintf("Peer %s is DOWN (%d consecutive failures). Admin: %s",
			peer.URL, consecutiveFailures, peer.AdminEmail)
		if _, err := s.db.AddNotification(nil, &peerID, msg); err != nil {
			fmt.Printf("   ⚠️  Failed to create notification: %v\n", err)
		}
	} else if previousStatus != status && status == "up" {
		msg := fmt.Sprintf("Peer %s is back UP. Admin: %s", peer.URL, peer.AdminEmail)
		if _, err := s.db.AddNotification(nil, &peerID, msg); err != nil {
			fmt.Printf("   ⚠️  Failed to create notification: %v\n", err)
		}
	}

	if status == "up" {
		fmt.Println("   ✅ UP")
	} else {
		fmt.Printf("   ❌ DOWN: %v\n", err)
	}
}

func (s *Service) StartMonitoring() {
	interval := time.Duration(s.config.PeerCheckInterval) * time.Second
	s.ticker = time.NewTicker(interval)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		// Perform initial check
		s.checkAllPeers()

		for {
			select {
			case <-s.ticker.C:
				s.checkAllPeers()
			case <-s.quit:
				return
			}
		}
	}()

	fmt.Printf("   🔄 Peer monitoring started (check every %d seconds)\n", s.config.PeerCheckInterval)
}

func (s *Service) checkAllPeers() {
	peers, err := s.db.GetAllPeers()
	if err != nil {
		fmt.Printf("❌ Failed to get peers: %v\n", err)
		return
	}

	for i := range peers {
		s.PerformPeerCheck(&peers[i])
	}
}

func (s *Service) StopMonitoring() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.quit)
	s.wg.Wait()
}

func (s *Service) GetHealthStatus(instanceName string) (*HealthResponse, error) {
	stats, err := s.db.GetServiceStats()
	if err != nil {
		return nil, err
	}

	uptime := int64(time.Since(s.startTime).Seconds())

	return &HealthResponse{
		Status:            "ok",
		InstanceName:      instanceName,
		Uptime:            uptime,
		ServicesMonitored: stats.Total,
		ServicesUp:        stats.Up,
		ServicesDown:      stats.Down,
		Timestamp:         time.Now().Format(time.RFC3339),
	}, nil
}
