package config

import (
	"fmt"
	"net/url"
	"os"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Name        string `toml:"name"`
	Caregiver   string `toml:"caregiver"`
	Port        int    `toml:"port"`
	BaseURL     string `toml:"base_url"`
	MaxDaysLogs int    `toml:"max_days_logs"`
	Database    DatabaseConfig   `toml:"database"`
	Email       EmailConfig      `toml:"email"`
	Monitoring  MonitoringConfig `toml:"monitoring"`
	UI          UIConfig         `toml:"ui"`
}

type DatabaseConfig struct {
	Path string `toml:"path"`
}

type EmailConfig struct {
	SMTPServer   string `toml:"smtp_server"`
	SMTPPort     int    `toml:"smtp_port"`
	SMTPUser     string `toml:"smtp_user"`
	SMTPPassword string `toml:"smtp_password"`
	FromEmail    string `toml:"from_email"`
}

type MonitoringConfig struct {
	DefaultCheckInterval int `toml:"default_check_interval"`
	Timeout              int `toml:"timeout"`
	MaxRetries           int `toml:"max_retries"`
	FailureThreshold     int `toml:"failure_threshold"`
}

type UIConfig struct {
	RefreshInterval int `toml:"refresh_interval"`
}

type PatientsConfig struct {
	Patients []PatientEntry `toml:"patients"`
}

type PatientEntry struct {
	URL           string `toml:"url"`
	CheckInterval *int   `toml:"check_interval"`
	Caregiver     string `toml:"caregiver"` // Optional: notify this email, defaults to server caregiver
}

func LoadConfig() (*Config, error) {
	configPath := "bjishk.toml"

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("configuration file not found: %s", configPath)
	}

	var config Config
	if err := toml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Validate required fields
	if config.Name == "" {
		return nil, fmt.Errorf("missing required field: name")
	}
	if config.Caregiver == "" {
		return nil, fmt.Errorf("missing required field: caregiver")
	}
	if config.Port == 0 {
		return nil, fmt.Errorf("missing required field: port")
	}
	if config.BaseURL == "" {
		return nil, fmt.Errorf("missing required field: base_url")
	}

	// Set defaults
	if config.MaxDaysLogs == 0 {
		config.MaxDaysLogs = 30
	}

	return &config, nil
}

func LoadPatients() (*PatientsConfig, error) {
	patientsPath := "patients.toml"

	data, err := os.ReadFile(patientsPath)
	if err != nil {
		return nil, fmt.Errorf("patients file not found: %s", patientsPath)
	}

	var patients PatientsConfig
	if err := toml.Unmarshal(data, &patients); err != nil {
		return nil, fmt.Errorf("failed to parse patients: %w", err)
	}

	// Validate each patient
	for i, patient := range patients.Patients {
		if patient.URL == "" {
			return nil, fmt.Errorf("patient %d missing required field: url", i)
		}
		// Validate URL format
		if _, err := url.Parse(patient.URL); err != nil {
			return nil, fmt.Errorf("invalid URL format: %s", patient.URL)
		}
	}

	return &patients, nil
}
