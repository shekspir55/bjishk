package notification

import (
	"fmt"
	"sync"
	"time"

	"github.com/yourusername/bjishk/internal/database"
	"gopkg.in/gomail.v2"
)

type Service struct {
	db       *database.DB
	config   EmailConfig
	dialer   *gomail.Dialer
	ticker   *time.Ticker
	quit     chan struct{}
	wg       sync.WaitGroup
}

type EmailConfig struct {
	SMTPServer   string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	FromEmail    string
}

func New(db *database.DB, config EmailConfig) *Service {
	dialer := gomail.NewDialer(config.SMTPServer, config.SMTPPort, config.SMTPUser, config.SMTPPassword)

	return &Service{
		db:     db,
		config: config,
		dialer: dialer,
		quit:   make(chan struct{}),
	}
}

func (s *Service) VerifyConnection() bool {
	closer, err := s.dialer.Dial()
	if err != nil {
		fmt.Printf("   ⚠️  SMTP connection failed: %v\n", err)
		return false
	}
	closer.Close()
	fmt.Println("   ✅ SMTP connection verified")
	return true
}

func (s *Service) SendEmail(to, subject, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.config.FromEmail)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	return s.dialer.DialAndSend(m)
}

func (s *Service) ProcessNotifications(adminEmail string) {
	notifications, err := s.db.GetPendingNotifications()
	if err != nil {
		fmt.Printf("❌ Failed to get pending notifications: %v\n", err)
		return
	}

	if len(notifications) == 0 {
		return
	}

	fmt.Printf("📧 Processing %d pending notifications...\n", len(notifications))

	for _, notif := range notifications {
		subject := "Bjishk Health Monitor Alert"
		body := notif.Message

		err := s.SendEmail(adminEmail, subject, body)
		notifID := int(notif.ID)
		if err != nil {
			errMsg := err.Error()
			if err := s.db.MarkNotificationSent(notifID, false, &errMsg); err != nil {
				fmt.Printf("   ❌ Failed to mark notification as failed: %v\n", err)
			}
			fmt.Printf("   ❌ Failed to send notification %d: %v\n", notifID, err)
		} else {
			if err := s.db.MarkNotificationSent(notifID, true, nil); err != nil {
				fmt.Printf("   ⚠️  Failed to mark notification as sent: %v\n", err)
			}
			fmt.Printf("   ✅ Sent notification %d\n", notifID)
		}
	}
}

func (s *Service) StartProcessing(adminEmail string) {
	s.ticker = time.NewTicker(30 * time.Second)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ticker.C:
				s.ProcessNotifications(adminEmail)
			case <-s.quit:
				return
			}
		}
	}()

	fmt.Println("   📨 Started (checking every 30 seconds)")
}

func (s *Service) StopProcessing() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.quit)
	s.wg.Wait()
}

func (s *Service) Close() {
	s.StopProcessing()
}
