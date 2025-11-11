package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Name        string   `toml:"name"`
	AdminEmail  string   `toml:"admin_email"`
	Port        int      `toml:"port"`
	BaseURL     string   `toml:"base_url"`
	MaxDaysLogs int      `toml:"max_days_logs"`
	PeerInstances []string `toml:"peer_instances"`
	Database    DatabaseConfig    `toml:"database"`
	Email       EmailConfig       `toml:"email"`
	Monitoring  MonitoringConfig  `toml:"monitoring"`
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

type ServicesConfig struct {
	Services []ServiceEntry `toml:"services"`
}

type ServiceEntry struct {
	URL           string  `toml:"url"`
	CheckInterval *int    `toml:"check_interval"`
}

type PeerInstance struct {
	URL        string
	AdminEmail string
}

func LoadConfig() (*Config, error) {
	configPath := ".bjishk.toml"

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
	if config.AdminEmail == "" {
		return nil, fmt.Errorf("missing required field: admin_email")
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
	if config.PeerInstances == nil {
		config.PeerInstances = []string{}
	}

	return &config, nil
}

func LoadServices() (*ServicesConfig, error) {
	servicesPath := ".services.toml"

	data, err := os.ReadFile(servicesPath)
	if err != nil {
		return nil, fmt.Errorf("services file not found: %s", servicesPath)
	}

	var services ServicesConfig
	if err := toml.Unmarshal(data, &services); err != nil {
		return nil, fmt.Errorf("failed to parse services: %w", err)
	}

	// Validate each service
	for i, service := range services.Services {
		if service.URL == "" {
			return nil, fmt.Errorf("service %d missing required field: url", i)
		}
		// Validate URL format
		if _, err := url.Parse(service.URL); err != nil {
			return nil, fmt.Errorf("invalid URL format: %s", service.URL)
		}
	}

	return &services, nil
}

func ParsePeerInstances(peerStrings []string) []PeerInstance {
	var peers []PeerInstance

	for _, peerStr := range peerStrings {
		// Find the last colon to split URL and email
		// This handles URLs with ports like http://example.com:3015:admin@example.com
		lastColon := strings.LastIndex(peerStr, ":")
		if lastColon == -1 {
			continue
		}

		url := strings.TrimSpace(peerStr[:lastColon])
		email := strings.TrimSpace(peerStr[lastColon+1:])

		if url != "" && email != "" {
			peers = append(peers, PeerInstance{
				URL:        url,
				AdminEmail: email,
			})
		}
	}

	return peers
}
