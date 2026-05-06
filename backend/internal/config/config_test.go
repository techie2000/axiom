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
