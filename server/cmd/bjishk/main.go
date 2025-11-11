package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
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
	for _, serviceConfig := range servicesConfig.Services {
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
			fmt.Printf("   ➕ Added service: %s (ID: %d)\n", service.URL, service.ID)
		} else {
			fmt.Printf("   ✓ Service already exists: %s\n", existing.URL)
		}
	}

	allServices, err := db.GetAllServices()
	if err != nil {
		log.Fatalf("❌ Failed to get services: %v\n", err)
	}
	fmt.Printf("   Total services: %d\n", len(allServices))

	// Initialize peer instances
	fmt.Println("\n🌐 Initializing peer instances...")
	peerInstances := config.ParsePeerInstances(cfg.PeerInstances)

	for _, peerConfig := range peerInstances {
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
			fmt.Printf("   ➕ Added peer: %s (%s)\n", peer.URL, peer.AdminEmail)
		} else {
			fmt.Printf("   ✓ Peer already exists: %s\n", existing.URL)
		}
	}

	allPeers, err := db.GetAllPeers()
	if err != nil {
		log.Fatalf("❌ Failed to get peers: %v\n", err)
	}
	fmt.Printf("   Total peers: %d\n", len(allPeers))

	// Initialize notification service
	fmt.Println("\n📧 Initializing notification service...")
	notifService := notification.New(db, notification.EmailConfig{
		SMTPServer:   cfg.Email.SMTPServer,
		SMTPPort:     cfg.Email.SMTPPort,
		SMTPUser:     cfg.Email.SMTPUser,
		SMTPPassword: cfg.Email.SMTPPassword,
		FromEmail:    cfg.Email.FromEmail,
	})
	notifService.VerifyConnection()

	// Initialize service monitor
	fmt.Println("\n🔍 Initializing service monitor...")
	serviceMonitor := monitor.New(db, monitor.MonitorConfig{
		Retries:    cfg.Monitoring.MaxRetries,
		RetryDelay: 2, // 2 seconds
		Timeout:    10,
	})

	// Start monitoring all services
	for i := range allServices {
		serviceMonitor.StartMonitoring(&allServices[i])
	}

	// Initialize federation service
	fmt.Println("\n🌍 Initializing federation service...")
	fedService := federation.New(db, federation.FederationConfig{
		Retries:           cfg.Monitoring.MaxRetries,
		RetryDelay:        2,
		PeerCheckInterval: 60, // Check peers every 60 seconds
	})

	// Start peer monitoring
	if len(allPeers) > 0 {
		fedService.StartMonitoring()
	}

	// Start HTTP server for federation
	fmt.Println("\n🚀 Starting HTTP server...")
	httpServer := server.New(fedService, cfg.Name, cfg.Port)
	go func() {
		if err := httpServer.Start(); err != nil {
			log.Printf("❌ HTTP server error: %v\n", err)
		}
	}()

	// Start notification processing
	fmt.Println("\n📨 Starting notification processing...")
	notifService.StartProcessing(cfg.AdminEmail)

	// Cleanup old logs daily
	fmt.Println("\n🧹 Scheduling log cleanup...")
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			deleted, err := db.CleanupOldLogs(cfg.MaxDaysLogs)
			if err != nil {
				log.Printf("❌ Failed to cleanup logs: %v\n", err)
			} else if deleted > 0 {
				fmt.Printf("🧹 Cleaned up %d old log entries\n", deleted)
			}
		}
	}()

	// Display peer connection string
	fmt.Println("\n" + string([]rune{0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550}))
	fmt.Println("📡 PEER CONNECTION STRING")
	fmt.Println(string([]rune{0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550}))
	fmt.Printf("\nAdd this to other Bjishk instances' .bjishk.toml:\n\n")
	fmt.Printf("  peer_instances = [\n")
	fmt.Printf("    \"%s:%s\"\n", cfg.BaseURL, cfg.AdminEmail)
	fmt.Printf("  ]\n")
	fmt.Println("\n" + string([]rune{0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550, 0x2550}))

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
