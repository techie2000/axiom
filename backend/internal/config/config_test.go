package config

import (
	"strings"
	"testing"

	"github.com/spf13/viper"
)

// resetViper clears all viper state between tests so defaults and env bindings
// set in one test do not leak into another.
func resetViper() {
	viper.Reset()
}

func TestValidateSecrets_MissingJWTSecret(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: ""},
		Database: DatabaseConfig{Password: "somepass"},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when JWT secret is empty, got nil")
	}
}

func TestValidateSecrets_MissingDatabasePassword(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: ""},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when DATABASE_PASSWORD is empty, got nil")
	}
}

func TestValidateSecrets_PlaceholderJWTSecretRejected(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "CHANGE_ME_REQUIRED"},
		Database: DatabaseConfig{Password: "somepass"},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when JWT_SECRET is a placeholder, got nil")
	}
}

func TestValidateSecrets_PlaceholderDatabasePasswordRejected(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "CHANGE_ME_REQUIRED"},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when DATABASE_PASSWORD is a placeholder, got nil")
	}
}

func TestValidateSecrets_PlaywrightPasswordRequiredWhenSeedEnabled(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "somepass"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     true,
			PlaywrightUserPassword: "",
		},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when PLAYWRIGHT_SEED_USER=true and PLAYWRIGHT_USER_PASSWORD is empty, got nil")
	}
}

func TestValidateSecrets_PlaywrightPasswordNotRequiredWhenSeedDisabled(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "somepass"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     false,
			PlaywrightUserPassword: "",
		},
	}
	err := validateSecrets(cfg)
	if err != nil {
		t.Fatalf("expected no error when PLAYWRIGHT_SEED_USER=false, got: %v", err)
	}
}

func TestValidateSecrets_AllSecretsPresent(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "a-strong-random-secret"},
		Database: DatabaseConfig{Password: "db-password"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     true,
			PlaywrightUserPassword: "test-password",
		},
	}
	err := validateSecrets(cfg)
	if err != nil {
		t.Fatalf("expected no error when all secrets are set, got: %v", err)
	}
}

func TestSetDefaults_NoHardCodedSecrets(t *testing.T) {
	resetViper()
	defer resetViper()
	setDefaults()

	// Database password must have no default (empty string)
	if pw := viper.GetString("database.password"); pw != "" {
		t.Errorf("database.password default should be empty, got %q", pw)
	}

	// JWT secret must have no default
	if secret := viper.GetString("jwt.secret"); secret != "" {
		t.Errorf("jwt.secret default should be empty, got %q", secret)
	}

	// Playwright password must have no default
	if pass := viper.GetString("testing.playwrightuserpassword"); pass != "" {
		t.Errorf("testing.playwrightuserpassword default should be empty, got %q", pass)
	}

	// RabbitMQ URL default must not contain embedded credentials
	mqURL := viper.GetString("rabbitmq.url")
	if mqURL == "" {
		t.Error("rabbitmq.url should have a default (without credentials)")
	}
	// The default should not contain a username:password pair
	for _, credPattern := range []string{"guest:guest", "guest@", ":@"} {
		if strings.Contains(mqURL, credPattern) {
			t.Errorf("rabbitmq.url default %q contains embedded credentials (pattern %q)", mqURL, credPattern)
		}
	}
}

func TestValidateSecrets_PlaywrightSeedBlockedInReleaseMode(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "somepass"},
		Server:   ServerConfig{Mode: "release"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     true,
			PlaywrightUserPassword: "test-password",
		},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when PLAYWRIGHT_SEED_USER=true in release mode, got nil")
	}
	if !strings.Contains(err.Error(), "release") {
		t.Errorf("error message should mention 'release', got: %v", err)
	}
}

func TestValidateSecrets_PlaywrightSeedAllowedInDebugMode(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "somepass"},
		Server:   ServerConfig{Mode: "debug"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     true,
			PlaywrightUserPassword: "test-password",
		},
	}
	err := validateSecrets(cfg)
	if err != nil {
		t.Fatalf("expected no error when PLAYWRIGHT_SEED_USER=true in debug mode, got: %v", err)
	}
}

func TestValidateSecrets_PlaceholderPlaywrightPasswordRejectedWhenSeedEnabled(t *testing.T) {
	cfg := &Config{
		JWT:      JWTConfig{Secret: "some-secret"},
		Database: DatabaseConfig{Password: "somepass"},
		Server:   ServerConfig{Mode: "debug"},
		Testing: TestingConfig{
			PlaywrightSeedUser:     true,
			PlaywrightUserPassword: "CHANGE_ME_REQUIRED",
		},
	}
	err := validateSecrets(cfg)
	if err == nil {
		t.Fatal("expected error when PLAYWRIGHT_USER_PASSWORD is placeholder and seed is enabled, got nil")
	}
}

func TestValidateSecrets_PlaceholderPatternsRejected(t *testing.T) {
	cases := []string{
		"change-me-use-a-strong-password",
		"replace-with-output-of-openssl-rand-hex-32",
	}

	for _, placeholder := range cases {
		cfg := &Config{
			JWT:      JWTConfig{Secret: placeholder},
			Database: DatabaseConfig{Password: "somepass"},
		}
		if err := validateSecrets(cfg); err == nil {
			t.Fatalf("expected error for placeholder pattern %q in JWT secret", placeholder)
		}
	}
}

func TestLoad_UsesEnvForRequiredSecretsWithoutDefaults(t *testing.T) {
	resetViper()
	defer resetViper()

	t.Setenv("DATABASE_PASSWORD", "env-db-password")
	t.Setenv("JWT_SECRET", "env-jwt-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected Load to succeed with env-only required secrets, got: %v", err)
	}

	if cfg.Database.Password != "env-db-password" {
		t.Fatalf("expected DATABASE_PASSWORD from env, got %q", cfg.Database.Password)
	}
	if cfg.JWT.Secret != "env-jwt-secret" {
		t.Fatalf("expected JWT_SECRET from env, got %q", cfg.JWT.Secret)
	}
}
