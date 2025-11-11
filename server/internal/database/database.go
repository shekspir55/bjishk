package database

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/yourusername/bjishk/pkg/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DB struct {
	conn *gorm.DB
}

func New(dbPath string) (*DB, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	conn, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	return &DB{conn: conn}, nil
}

func (db *DB) Initialize() error {
	// Auto-migrate all models
	return db.conn.AutoMigrate(
		&models.Service{},
		&models.Peer{},
		&models.Notification{},
		&models.Log{},
	)
}

// Service operations
func (db *DB) AddService(url string, checkInterval int, name *string) (*models.Service, error) {
	service := &models.Service{
		URL:           url,
		Name:          name,
		CheckInterval: checkInterval,
		Status:        "unknown",
	}

	if err := db.conn.Create(service).Error; err != nil {
		return nil, err
	}

	return service, nil
}

func (db *DB) GetService(id int) (*models.Service, error) {
	var service models.Service
	err := db.conn.First(&service, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &service, nil
}

func (db *DB) GetServiceByURL(url string) (*models.Service, error) {
	var service models.Service
	err := db.conn.Where("url = ?", url).First(&service).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &service, nil
}

func (db *DB) GetAllServices() ([]models.Service, error) {
	var services []models.Service
	err := db.conn.Find(&services).Error
	return services, err
}

func (db *DB) UpdateService(id int, data map[string]interface{}) error {
	return db.conn.Model(&models.Service{}).Where("id = ?", id).Updates(data).Error
}

// Peer operations
func (db *DB) AddPeer(url, adminEmail string) (*models.Peer, error) {
	peer := &models.Peer{
		URL:        url,
		AdminEmail: adminEmail,
		Status:     "unknown",
	}

	if err := db.conn.Create(peer).Error; err != nil {
		return nil, err
	}

	return peer, nil
}

func (db *DB) GetPeerByURL(url string) (*models.Peer, error) {
	var peer models.Peer
	err := db.conn.Where("url = ?", url).First(&peer).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &peer, nil
}

func (db *DB) GetAllPeers() ([]models.Peer, error) {
	var peers []models.Peer
	err := db.conn.Find(&peers).Error
	return peers, err
}

func (db *DB) UpdatePeer(id int, data map[string]interface{}) error {
	return db.conn.Model(&models.Peer{}).Where("id = ?", id).Updates(data).Error
}

// Notification operations
func (db *DB) AddNotification(serviceID, peerID *int, message string) (*models.Notification, error) {
	var svcID, prID *uint
	if serviceID != nil {
		id := uint(*serviceID)
		svcID = &id
	}
	if peerID != nil {
		id := uint(*peerID)
		prID = &id
	}

	notification := &models.Notification{
		ServiceID: svcID,
		PeerID:    prID,
		Message:   message,
		Sent:      false,
	}

	if err := db.conn.Create(notification).Error; err != nil {
		return nil, err
	}

	return notification, nil
}

func (db *DB) MarkNotificationSent(id int, sent bool, errorMsg *string) error {
	return db.conn.Model(&models.Notification{}).Where("id = ?", id).Updates(map[string]interface{}{
		"sent":  sent,
		"error": errorMsg,
	}).Error
}

func (db *DB) GetPendingNotifications() ([]models.Notification, error) {
	var notifications []models.Notification
	err := db.conn.Where("sent = ?", false).Order("created_at ASC").Find(&notifications).Error
	return notifications, err
}

// Log operations
func (db *DB) AddLog(serviceID, peerID *int, status string, responseTime *int, message *string) error {
	var svcID, prID *uint
	if serviceID != nil {
		id := uint(*serviceID)
		svcID = &id
	}
	if peerID != nil {
		id := uint(*peerID)
		prID = &id
	}

	log := &models.Log{
		ServiceID:    svcID,
		PeerID:       prID,
		Status:       status,
		ResponseTime: responseTime,
		Message:      message,
	}

	return db.conn.Create(log).Error
}

func (db *DB) CleanupOldLogs(maxDays int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -maxDays)
	result := db.conn.Where("created_at < ?", cutoff).Delete(&models.Log{})
	return result.RowsAffected, result.Error
}

// Stats
func (db *DB) GetServiceStats() (*models.ServiceStats, error) {
	var stats models.ServiceStats
	var total, up, down, unknown int64

	db.conn.Model(&models.Service{}).Count(&total)
	db.conn.Model(&models.Service{}).Where("status = ?", "up").Count(&up)
	db.conn.Model(&models.Service{}).Where("status = ?", "down").Count(&down)
	db.conn.Model(&models.Service{}).Where("status = ?", "unknown").Count(&unknown)

	stats.Total = int(total)
	stats.Up = int(up)
	stats.Down = int(down)
	stats.Unknown = int(unknown)

	return &stats, nil
}

func (db *DB) Close() error {
	sqlDB, err := db.conn.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
