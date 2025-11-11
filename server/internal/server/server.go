package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/yourusername/bjishk/internal/federation"
)

type Server struct {
	federation   *federation.Service
	instanceName string
	port         int
	httpServer   *http.Server
}

func New(fed *federation.Service, instanceName string, port int) *Server {
	return &Server{
		federation:   fed,
		instanceName: instanceName,
		port:         port,
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

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	fmt.Printf("🌐 Starting HTTP server on port %d...\n", s.port)
	fmt.Printf("✅ HTTP server listening on http://localhost:%d\n", s.port)
	fmt.Printf("   Health endpoint: http://localhost:%d/api/health\n", s.port)

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
