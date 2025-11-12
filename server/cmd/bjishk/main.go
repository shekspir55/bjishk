package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/yourusername/bjishk/internal/config"
	"github.com/yourusername/bjishk/internal/database"
	"github.com/yourusername/bjishk/internal/federation"
	"github.com/yourusername/bjishk/internal/monitor"
	"github.com/yourusername/bjishk/internal/notification"
	"github.com/yourusername/bjishk/internal/server"
)

func main() {
	printHeader()

	cfg, db, err := initialize()
	if err != nil {
		log.Fatalf("❌ Fatal error: %v\n", err)
	}
	defer db.Close()

	// Load and add patients
	patientsConfig, err := config.LoadPatients()
	if err != nil {
		log.Fatalf("❌ Failed to load patients: %v\n", err)
	}

	fmt.Println("\n📝 Loading patients...")

	// Get all existing services from DB
	allServices, err := db.GetAllServices()
	if err != nil {
		log.Fatalf("❌ Failed to get services: %v\n", err)
	}

	// Build map of services from config
	configServices := make(map[string]bool)
	for _, patientConfig := range patientsConfig.Patients {
		configServices[patientConfig.URL] = true

		existing, err := db.GetServiceByURL(patientConfig.URL)
		if err != nil {
			log.Printf("   ⚠️  Error checking patient: %v\n", err)
			continue
		}

		if existing == nil {
			checkInterval := cfg.Monitoring.DefaultCheckInterval
			if patientConfig.CheckInterval != nil {
				checkInterval = *patientConfig.CheckInterval
			}
			caregiver := patientConfig.Caregiver
			if caregiver == "" {
				caregiver = cfg.Caregiver
			}
			service, err := db.AddService(patientConfig.URL, checkInterval, &caregiver)
			if err != nil {
				log.Printf("   ⚠️  Failed to add patient: %v\n", err)
				continue
			}
			fmt.Printf("   ➕ Added: %s\n", service.URL)
		}
	}

	// Remove services not in config
	for _, service := range allServices {
		if !configServices[service.URL] {
			if err := db.DeleteService(int(service.ID)); err != nil {
				log.Printf("   ⚠️  Failed to delete patient: %v\n", err)
			} else {
				fmt.Printf("   ➖ Removed: %s\n", service.URL)
			}
		}
	}

	// Refresh service list
	allServices, err = db.GetAllServices()
	if err != nil {
		log.Fatalf("❌ Failed to get services: %v\n", err)
	}

	if len(allServices) > 0 {
		fmt.Println("   Patients:")
		for _, svc := range allServices {
			fmt.Printf("     • %s\n", svc.URL)
		}
	} else {
		fmt.Println("   No patients configured")
	}

	// Initialize services
	fmt.Println("\n⚙️  Initializing services...")

	// Notification service
	notifService := notification.New(db, notification.EmailConfig{
		SMTPServer:   cfg.Email.SMTPServer,
		SMTPPort:     cfg.Email.SMTPPort,
		SMTPUser:     cfg.Email.SMTPUser,
		SMTPPassword: cfg.Email.SMTPPassword,
		FromEmail:    cfg.Email.FromEmail,
	})
	if notifService.VerifyConnection() {
		fmt.Println("   ✅ Email notifications")
	} else {
		fmt.Println("   ⚠️  Email notifications (SMTP failed)")
	}

	// Service monitor
	serviceMonitor := monitor.New(db, monitor.MonitorConfig{
		Retries:    cfg.Monitoring.MaxRetries,
		RetryDelay: 2,
		Timeout:    10,
	})
	for i := range allServices {
		serviceMonitor.StartMonitoring(&allServices[i])
	}
	fmt.Printf("   ✅ Patient monitoring (%d patient%s)\n", len(allServices), plural(len(allServices)))

	// Federation service
	fedService := federation.New(db, federation.FederationConfig{
		Retries:           cfg.Monitoring.MaxRetries,
		RetryDelay:        2,
		PeerCheckInterval: 60,
	})

	// HTTP server
	httpServer := server.New(db, fedService, cfg.Name, cfg.Port, cfg.UI.RefreshInterval)
	go func() {
		if err := httpServer.Start(); err != nil {
			log.Printf("❌ HTTP server error: %v\n", err)
		}
	}()

	// Wait for server to start
	time.Sleep(100 * time.Millisecond)
	fmt.Printf("   ✅ HTTP server (port %d)\n", cfg.Port)

	// Start background services
	notifService.StartProcessing(cfg.Caregiver)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if deleted, err := db.CleanupOldLogs(cfg.MaxDaysLogs); err == nil && deleted > 0 {
				log.Printf("🧹 Cleaned up %d old log entries\n", deleted)
			}
		}
	}()

	// Display peer connection string
	fmt.Println("\n" + strings.Repeat("═", 60))
	fmt.Println("📡 PEER CONNECTION STRING")
	fmt.Println(strings.Repeat("═", 60))
	fmt.Printf("\nAsk people to add this in their patients.toml:\n\n")
	fmt.Printf("  [[patients]]\n")
	fmt.Printf("  url = \"%s/api/health\"\n", cfg.BaseURL)
	fmt.Printf("  caregiver = \"%s\"\n", cfg.Caregiver)
	fmt.Println("\n" + strings.Repeat("═", 60))

	fmt.Println("\n✨ Bjishk is running! Press Ctrl+C to stop.\n")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	// Graceful shutdown
	fmt.Println("\n\n🛑 Shutting down gracefully...")

	serviceMonitor.StopAll()
	notifService.StopProcessing()
	fedService.StopMonitoring()
	httpServer.Stop()
	notifService.Close()
	db.Close()

	fmt.Println("💾 Database closed")
	fmt.Println("👋 Goodbye!\n")
}

func printHeader() {
	fmt.Println("╔═══════════════════════════════════════╗")
	fmt.Println("║           🏥 BJISHK v1.0             ║")
	fmt.Println("║   Decentralized Health Monitoring    ║")
	fmt.Println("╚═══════════════════════════════════════╝\n")
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func initialize() (*config.Config, *database.DB, error) {
	// Load configuration
	fmt.Println("📋 Loading configuration...")
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, nil, err
	}

	fmt.Printf("   Instance: %s\n", cfg.Name)
	fmt.Printf("   Caregiver: %s\n", cfg.Caregiver)
	fmt.Printf("   Port: %d\n", cfg.Port)
	fmt.Printf("   Database: %s\n", cfg.Database.Path)

	// Initialize database
	fmt.Println("\n💾 Initializing database...")
	db, err := database.New(cfg.Database.Path)
	if err != nil {
		return nil, nil, err
	}

	if err := db.Initialize(); err != nil {
		db.Close()
		return nil, nil, err
	}

	fmt.Println("   ✅ Database initialized")

	return cfg, db, nil
}
