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

	// Load and add services
	servicesConfig, err := config.LoadServices()
	if err != nil {
		log.Fatalf("❌ Failed to load services: %v\n", err)
	}

	fmt.Println("\n📝 Loading services...")

	// Get all existing services from DB
	allServices, err := db.GetAllServices()
	if err != nil {
		log.Fatalf("❌ Failed to get services: %v\n", err)
	}

	// Build map of services from config
	configServices := make(map[string]bool)
	for _, serviceConfig := range servicesConfig.Services {
		configServices[serviceConfig.URL] = true

		existing, err := db.GetServiceByURL(serviceConfig.URL)
		if err != nil {
			log.Printf("   ⚠️  Error checking service: %v\n", err)
			continue
		}

		if existing == nil {
			checkInterval := cfg.Monitoring.DefaultCheckInterval
			if serviceConfig.CheckInterval != nil {
				checkInterval = *serviceConfig.CheckInterval
			}
			service, err := db.AddService(serviceConfig.URL, checkInterval, nil)
			if err != nil {
				log.Printf("   ⚠️  Failed to add service: %v\n", err)
				continue
			}
			fmt.Printf("   ➕ Added: %s\n", service.URL)
		}
	}

	// Remove services not in config
	for _, service := range allServices {
		if !configServices[service.URL] {
			if err := db.DeleteService(int(service.ID)); err != nil {
				log.Printf("   ⚠️  Failed to delete service: %v\n", err)
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
		fmt.Println("   Services:")
		for _, svc := range allServices {
			fmt.Printf("     • %s\n", svc.URL)
		}
	} else {
		fmt.Println("   No services configured")
	}

	// Initialize peer instances
	fmt.Println("\n🌐 Peer instances...")
	peerInstances := config.ParsePeerInstances(cfg.PeerInstances)

	// Get all existing peers
	allPeers, err := db.GetAllPeers()
	if err != nil {
		log.Fatalf("❌ Failed to get peers: %v\n", err)
	}

	// Build map of peers from config
	configPeers := make(map[string]bool)
	for _, peerConfig := range peerInstances {
		configPeers[peerConfig.URL] = true

		existing, err := db.GetPeerByURL(peerConfig.URL)
		if err != nil {
			log.Printf("   ⚠️  Error checking peer: %v\n", err)
			continue
		}

		if existing == nil {
			peer, err := db.AddPeer(peerConfig.URL, peerConfig.AdminEmail)
			if err != nil {
				log.Printf("   ⚠️  Failed to add peer: %v\n", err)
				continue
			}
			fmt.Printf("   ➕ Added: %s (%s)\n", peer.URL, peer.AdminEmail)
		}
	}

	// Remove peers not in config
	for _, peer := range allPeers {
		if !configPeers[peer.URL] {
			if err := db.DeletePeer(int(peer.ID)); err != nil {
				log.Printf("   ⚠️  Failed to delete peer: %v\n", err)
			} else {
				fmt.Printf("   ➖ Removed: %s\n", peer.URL)
			}
		}
	}

	// Refresh peer list
	allPeers, err = db.GetAllPeers()
	if err != nil {
		log.Fatalf("❌ Failed to get peers: %v\n", err)
	}

	if len(allPeers) > 0 {
		fmt.Println("   Peers:")
		for _, peer := range allPeers {
			fmt.Printf("     • %s (%s)\n", peer.URL, peer.AdminEmail)
		}
	} else {
		fmt.Println("   No peers configured")
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
	fmt.Printf("   ✅ Service monitoring (%d service%s)\n", len(allServices), plural(len(allServices)))

	// Federation service
	fedService := federation.New(db, federation.FederationConfig{
		Retries:           cfg.Monitoring.MaxRetries,
		RetryDelay:        2,
		PeerCheckInterval: 60,
	})
	if len(allPeers) > 0 {
		fedService.StartMonitoring()
		fmt.Printf("   ✅ Peer monitoring (%d peer%s)\n", len(allPeers), plural(len(allPeers)))
	}

	// HTTP server
	httpServer := server.New(fedService, cfg.Name, cfg.Port)
	go func() {
		if err := httpServer.Start(); err != nil {
			log.Printf("❌ HTTP server error: %v\n", err)
		}
	}()

	// Wait for server to start
	time.Sleep(100 * time.Millisecond)
	fmt.Printf("   ✅ HTTP server (port %d)\n", cfg.Port)

	// Start background services
	notifService.StartProcessing(cfg.AdminEmail)
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
	fmt.Printf("\nAsk people to add this in their peer_instances:\n\n")
	fmt.Printf("  %s:%d:%s\n", cfg.BaseURL, cfg.Port, cfg.AdminEmail)
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
	fmt.Printf("   Admin: %s\n", cfg.AdminEmail)
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
