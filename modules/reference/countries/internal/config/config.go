package config

import (
	"fmt"
	"os"
)

// Config holds all configuration for the countries service
type Config struct {
	Database Database
	RabbitMQ RabbitMQ
	Service  Service
}

type Database struct {
	Host     string
	Port     string
	Name     string
	Schema   string
	User     string
	Password string
	SSLMode  string
}

type RabbitMQ struct {
	Host     string
	Port     string
	User     string
	Password string
	VHost    string
	Queue    string
}

type Service struct {
	LogLevel string
	Port     string
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		Database: Database{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			Name:     getEnv("DB_NAME", "axiom_db"),
			Schema:   getEnv("DB_SCHEMA", "reference"),
			User:     getEnv("DB_USER", "axiom"),
			Password: getEnv("DB_PASSWORD", ""),
			SSLMode:  getEnv("DB_SSLMODE", "prefer"),
		},
		RabbitMQ: RabbitMQ{
			Host:     getEnv("RABBITMQ_HOST", "localhost"),
			Port:     getEnv("RABBITMQ_PORT", "5672"),
			User:     getEnv("RABBITMQ_USER", "axiom"),
			Password: getEnv("RABBITMQ_PASSWORD", ""),
			VHost:    getEnv("RABBITMQ_VHOST", "/axiom"),
			Queue:    getEnv("RABBITMQ_QUEUE", "axiom.reference.countries"),
		},
		Service: Service{
			LogLevel: getEnv("LOG_LEVEL", "info"),
			Port:     getEnv("PORT", "8080"),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks if required configuration is present
func (c *Config) Validate() error {
	if c.Database.Password == "" {
		return fmt.Errorf("DB_PASSWORD is required")
	}
	if c.RabbitMQ.Password == "" {
		return fmt.Errorf("RABBITMQ_PASSWORD is required")
	}
	return nil
}

// ConnectionString returns a PostgreSQL connection string
func (d *Database) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s search_path=%s",
		d.Host, d.Port, d.User, d.Password, d.Name, d.SSLMode, d.Schema,
	)
}

// ConnectionURL returns a RabbitMQ connection URL
func (r *RabbitMQ) ConnectionURL() string {
	return fmt.Sprintf(
		"amqp://%s:%s@%s:%s%s",
		r.User, r.Password, r.Host, r.Port, r.VHost,
	)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
