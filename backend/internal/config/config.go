package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	RabbitMQ RabbitMQConfig
	Log      LogConfig
	CORS     CORSConfig
	LEI      LEIConfig
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Port int
	Mode string // debug, release, test
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
	LogLevel string // silent, error, warn, info
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	Secret string
	Expiry time.Duration
}

// RabbitMQConfig holds RabbitMQ configuration
type RabbitMQConfig struct {
	URL string
}

// LogConfig holds logging configuration
type LogConfig struct {
	Level string // debug, info, warn, error
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	AllowedMethods []string `mapstructure:"allowed_methods"`
	AllowedHeaders []string `mapstructure:"allowed_headers"`
}

// LEIConfig holds LEI data acquisition and scheduling configuration
type LEIConfig struct {
	DataDir           string // Directory to store LEI files
	DeltaSyncInterval string // How often to run delta sync (e.g., "1h", "2h")
	FullSyncDay       string // Day of week for full sync (e.g., "Sunday")
	FullSyncTime      string // Time for full sync (HH:MM format, e.g., "02:00")
	CleanupTime       string // Time for daily cleanup (HH:MM format, e.g., "00:00" for midnight)
	KeepFullFiles     int    // Number of full files to retain
	KeepDeltaFiles    int    // Number of delta files to retain
	// GLEIFRAListURL is the URL of the GLEIF Registration Authorities List CSV download.
	// Leave empty to use the built-in default URL.
	GLEIFRAListURL string
}

// Load loads configuration from file and environment variables
func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")

	// Set defaults
	setDefaults()

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		// Config file not found; use defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	// Override with environment variables
	// Map DATABASE_HOST to database.host, DATABASE_PORT to database.port, etc.
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.mode", "debug")

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "axiom")
	viper.SetDefault("database.password", "axiom")
	viper.SetDefault("database.name", "axiom")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.loglevel", "warn") // warn suppresses 'record not found' info messages

	// JWT defaults
	viper.SetDefault("jwt.secret", "change-this-secret-in-production")
	viper.SetDefault("jwt.expiry", "24h")

	// RabbitMQ defaults
	viper.SetDefault("rabbitmq.url", "amqp://guest:guest@localhost:5672/")

	// Log defaults
	viper.SetDefault("log.level", "info")

	// CORS defaults
	viper.SetDefault("cors.allowed_origins", []string{"http://localhost:3000"})
	viper.SetDefault("cors.allowed_methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allowed_headers", []string{"Origin", "Content-Type", "Authorization"})

	// LEI defaults
	viper.SetDefault("lei.datadir", "./data/lei")
	viper.SetDefault("lei.deltasyncinterval", "1h") // Every hour
	viper.SetDefault("lei.fullsyncday", "Sunday")   // Weekly on Sunday
	viper.SetDefault("lei.fullsynctime", "02:00")   // 2 AM
	viper.SetDefault("lei.cleanuptime", "00:00")    // Midnight - runs BEFORE all syncs
	viper.SetDefault("lei.keepfullfiles", 2)        // Keep 2 full files (~1.8GB)
	viper.SetDefault("lei.keepdeltafiles", 5)       // Keep 5 delta files (~65MB)
}
