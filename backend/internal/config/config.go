package config

import (
	"fmt"
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
	Testing  TestingConfig
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

// TestingConfig holds configuration for automated testing environments.
// These settings are only intended for dev and main environments and must
// never be enabled in UAT or production.
type TestingConfig struct {
	// PlaywrightSeedUser controls whether a dedicated Playwright test user is
	// automatically created on startup. Set PLAYWRIGHT_SEED_USER=true in
	// dev/main .env files only — never in UAT or production.
	PlaywrightSeedUser bool `mapstructure:"playwrightseeduser"`
	// PlaywrightUserEmail is the email address for the Playwright test user.
	// Controlled by PLAYWRIGHT_USER_EMAIL; defaults to playwright@axiom.local.
	PlaywrightUserEmail string `mapstructure:"playwrightuseremail"`
	// PlaywrightUserPassword is the password for the Playwright test user.
	// Controlled by PLAYWRIGHT_USER_PASSWORD; must be set explicitly when PlaywrightSeedUser is true.
	PlaywrightUserPassword string `mapstructure:"playwrightuserpassword"`
}

// LEIConfig holds LEI data acquisition and scheduling configuration
type LEIConfig struct {
	DataDir           string // Directory to store LEI files
	DeltaSyncInterval string // How often to run delta sync (e.g., "1h", "2h")
	FullSyncDay       string // Day of week for full sync (e.g., "Sunday")
	FullSyncTime      string // Time for full sync (HH:MM format, e.g., "12:00")
	CleanupTime       string // Time for daily cleanup (HH:MM format, e.g., "00:00" for midnight)
	KeepFullFiles     int    // Number of full files to retain
	KeepDeltaFiles    int    // Number of delta files to retain
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

	// Bind user-friendly env var names for Playwright testing configuration.
	// These override the default TESTING_* prefix that AutomaticEnv would produce.
	if err := viper.BindEnv("testing.playwrightseeduser", "PLAYWRIGHT_SEED_USER"); err != nil {
		return nil, err
	}
	if err := viper.BindEnv("testing.playwrightuseremail", "PLAYWRIGHT_USER_EMAIL"); err != nil {
		return nil, err
	}
	if err := viper.BindEnv("testing.playwrightuserpassword", "PLAYWRIGHT_USER_PASSWORD"); err != nil {
		return nil, err
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, err
	}

	if err := validateSecrets(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.mode", "debug")

	// Database defaults
	// NOTE: database.password has no default; set DATABASE_PASSWORD env var (required).
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "axiom")
	viper.SetDefault("database.name", "axiom")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.loglevel", "warn") // warn suppresses 'record not found' info messages

	// JWT defaults
	// NOTE: jwt.secret has no default; set JWT_SECRET env var to a strong random value (required).
	viper.SetDefault("jwt.expiry", "24h")

	// RabbitMQ defaults
	// NOTE: rabbitmq.url has no credential defaults; set RABBITMQ_URL with credentials (required).
	viper.SetDefault("rabbitmq.url", "amqp://localhost:5672/")

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
	viper.SetDefault("lei.fullsynctime", "12:00")   // 12:00 UTC
	viper.SetDefault("lei.cleanuptime", "00:00")    // Midnight - runs BEFORE all syncs
	viper.SetDefault("lei.keepfullfiles", 2)        // Keep 2 full files (~1.8GB)
	viper.SetDefault("lei.keepdeltafiles", 5)       // Keep 5 delta files (~65MB)

	// Testing defaults (only active when PLAYWRIGHT_SEED_USER=true)
	// NOTE: testing.playwrightuserpassword has no default; set PLAYWRIGHT_USER_PASSWORD env var.
	viper.SetDefault("testing.playwrightseeduser", false)
	viper.SetDefault("testing.playwrightuseremail", "playwright@axiom.local")
}

// validateSecrets returns an error if required secret environment variables are missing.
// This provides fail-fast startup rather than allowing the application to run with
// insecure or missing credentials.
func validateSecrets(cfg *Config) error {
	if cfg.JWT.Secret == "" {
		return fmt.Errorf("JWT_SECRET is required: set the JWT_SECRET environment variable to a strong random secret")
	}
	if cfg.Database.Password == "" {
		return fmt.Errorf("DATABASE_PASSWORD is required: set the DATABASE_PASSWORD environment variable")
	}
	if cfg.Testing.PlaywrightSeedUser && cfg.Testing.PlaywrightUserPassword == "" {
		return fmt.Errorf("PLAYWRIGHT_USER_PASSWORD is required when PLAYWRIGHT_SEED_USER=true: set the PLAYWRIGHT_USER_PASSWORD environment variable")
	}
	return nil
}
