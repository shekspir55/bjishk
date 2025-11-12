package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/yourusername/bjishk/internal/database"
	"github.com/yourusername/bjishk/internal/federation"
	"github.com/yourusername/bjishk/pkg/models"
)

type Server struct {
	db              *database.DB
	federation      *federation.Service
	instanceName    string
	port            int
	refreshInterval int
	httpServer      *http.Server
}

func New(db *database.DB, fed *federation.Service, instanceName string, port int, refreshInterval int) *Server {
	return &Server{
		db:              db,
		federation:      fed,
		instanceName:    instanceName,
		port:            port,
		refreshInterval: refreshInterval,
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Health endpoint for federation
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		health, err := s.federation.GetHealthStatus(s.instanceName)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(health)
	})

	// Config endpoint for UI
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		config := map[string]interface{}{
			"instance_name":    s.instanceName,
			"refresh_interval": s.refreshInterval,
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(config)
	})

	// UI endpoint for patient status
	mux.HandleFunc("/api/patients", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse date range parameters (default to last 24 hours in local time)
		var startDate, endDate *time.Time

		if startParam := r.URL.Query().Get("start"); startParam != "" {
			if t, err := time.Parse(time.RFC3339, startParam); err == nil {
				localTime := t.Local()
				startDate = &localTime
			}
		}
		if endParam := r.URL.Query().Get("end"); endParam != "" {
			if t, err := time.Parse(time.RFC3339, endParam); err == nil {
				localTime := t.Local()
				endDate = &localTime
			}
		}

		// Default to last 24 hours if no dates provided
		if startDate == nil && endDate == nil {
			now := time.Now()
			yesterday := now.Add(-24 * time.Hour)
			startDate = &yesterday
			endDate = &now
		}

		services, err := s.db.GetAllServices()
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		type PatientLog struct {
			Status       string `json:"status"`
			ResponseTime *int   `json:"response_time"`
			CreatedAt    string `json:"created_at"`
		}

		type PatientResponse struct {
			ID           uint         `json:"id"`
			URL          string       `json:"url"`
			Name         *string      `json:"name"`
			Status       string       `json:"status"`
			ResponseTime *int         `json:"response_time"`
			LastCheck    *string      `json:"last_check"`
			IsBjishk     bool         `json:"is_bjishk"`
			Logs         []PatientLog `json:"logs"`
		}

		var response []PatientResponse

		totalLogs := 0
		for _, svc := range services {
			logs, err := s.db.GetServiceLogsWithDateRange(int(svc.ID), startDate, endDate, 200)
			if err != nil {
				logs = []models.Log{} // Initialize empty slice on error
			}
			totalLogs += len(logs)

			var patientLogs []PatientLog
			for _, log := range logs {
				patientLogs = append(patientLogs, PatientLog{
					Status:       log.Status,
					ResponseTime: log.ResponseTime,
					CreatedAt:    log.CreatedAt.Format(time.RFC3339),
				})
			}

			// Ensure patientLogs is never nil
			if patientLogs == nil {
				patientLogs = []PatientLog{}
			}

			var lastCheck *string
			if svc.LastCheck != nil {
				lc := svc.LastCheck.Format(time.RFC3339)
				lastCheck = &lc
			}

			// Detect if this is a bjishk instance by checking if URL ends with /api/health
			isBjishk := false
			if len(svc.URL) >= 11 && svc.URL[len(svc.URL)-11:] == "/api/health" {
				isBjishk = true
			}

			response = append(response, PatientResponse{
				ID:           svc.ID,
				URL:          svc.URL,
				Name:         svc.Name,
				Status:       svc.Status,
				ResponseTime: svc.ResponseTime,
				LastCheck:    lastCheck,
				IsBjishk:     isBjishk,
				Logs:         patientLogs,
			})
		}


		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(response)
	})

	// Serve static files from client/dist
	distPath := filepath.Join(".", "client", "dist")
	if _, err := os.Stat(distPath); err == nil {
		fileServer := http.FileServer(http.Dir(distPath))
		mux.Handle("/", fileServer)
	}

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	return s.httpServer.ListenAndServe()
}

func (s *Server) Stop() error {
	if s.httpServer == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	fmt.Println("🛑 HTTP server stopped")
	return s.httpServer.Shutdown(ctx)
}
