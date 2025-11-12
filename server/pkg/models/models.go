package models

import (
	"time"

	"gorm.io/gorm"
)

type Service struct {
	ID                  uint           `gorm:"primaryKey"`
	URL                 string         `gorm:"uniqueIndex;not null"`
	Name                *string        `gorm:"type:text"`
	Caregiver           *string        `gorm:"type:text"`
	CheckInterval       int            `gorm:"not null"`
	LastCheck           *time.Time     `gorm:"type:datetime"`
	Status              string         `gorm:"default:'unknown'"`
	ConsecutiveFailures int            `gorm:"default:0"`
	ResponseTime        *int           `gorm:"type:integer"`
	CreatedAt           time.Time      `gorm:"autoCreateTime"`
	UpdatedAt           time.Time      `gorm:"autoUpdateTime"`
	DeletedAt           gorm.DeletedAt `gorm:"index"`
}

type Peer struct {
	ID                  uint           `gorm:"primaryKey"`
	URL                 string         `gorm:"uniqueIndex;not null"`
	AdminEmail          string         `gorm:"not null"`
	LastCheck           *time.Time     `gorm:"type:datetime"`
	Status              string         `gorm:"default:'unknown'"`
	ConsecutiveFailures int            `gorm:"default:0"`
	CreatedAt           time.Time      `gorm:"autoCreateTime"`
	UpdatedAt           time.Time      `gorm:"autoUpdateTime"`
	DeletedAt           gorm.DeletedAt `gorm:"index"`
}

type Notification struct {
	ID        uint           `gorm:"primaryKey"`
	ServiceID *uint          `gorm:"type:integer"`
	PeerID    *uint          `gorm:"type:integer"`
	Message   string         `gorm:"type:text;not null"`
	Sent      bool           `gorm:"default:false"`
	Error     *string        `gorm:"type:text"`
	CreatedAt time.Time      `gorm:"autoCreateTime"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type Log struct {
	ID           uint           `gorm:"primaryKey"`
	ServiceID    *uint          `gorm:"type:integer"`
	PeerID       *uint          `gorm:"type:integer"`
	Status       string         `gorm:"not null"`
	ResponseTime *int           `gorm:"type:integer"`
	Message      *string        `gorm:"type:text"`
	CreatedAt    time.Time      `gorm:"autoCreateTime"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

type ServiceStats struct {
	Total   int
	Up      int
	Down    int
	Unknown int
}
