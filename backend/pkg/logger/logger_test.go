package logger

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitWritesToFileWhenConfigured(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "backend.log")
	t.Setenv("LOG_FILE_PATH", logPath)
	t.Cleanup(Close)

	Init("info")
	Info().Msg("logger file sink test")

	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}

	if !strings.Contains(string(content), "logger file sink test") {
		t.Fatalf("expected log file to contain test message, got: %s", string(content))
	}
}

func TestInitCreatesLogDirectoryAutomatically(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "subdir", "backend.log")
	t.Setenv("LOG_FILE_PATH", logPath)
	t.Cleanup(Close)

	Init("info")
	Info().Msg("dir creation test")

	if _, err := os.Stat(logPath); err != nil {
		t.Fatalf("expected log file to exist after directory auto-creation: %v", err)
	}
}

func TestInitRotationSettingsAreApplied(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "backend.log")
	t.Setenv("LOG_FILE_PATH", logPath)
	t.Setenv("LOG_MAX_SIZE_MB", "5")
	t.Setenv("LOG_MAX_BACKUPS", "2")
	t.Setenv("LOG_MAX_AGE_DAYS", "3")
	t.Setenv("LOG_COMPRESS", "true")
	t.Cleanup(Close)

	Init("info")
	Info().Msg("rotation settings test")

	if _, err := os.Stat(logPath); err != nil {
		t.Fatalf("expected log file to exist: %v", err)
	}
}

func TestEnvIntFallsBackToDefault(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		fallback int
		want     int
	}{
		{"empty string", "", 10, 10},
		{"invalid string", "abc", 10, 10},
		{"zero", "0", 10, 10},
		{"negative", "-1", 10, 10},
		{"valid positive", "25", 10, 25},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("TEST_ENVINT_KEY", tt.value)
			got := envInt("TEST_ENVINT_KEY", tt.fallback)
			if got != tt.want {
				t.Errorf("envInt(%q, %d) = %d, want %d", tt.value, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestInitStdoutOnlyWhenNoFilePath(t *testing.T) {
	t.Setenv("LOG_FILE_PATH", "")
	t.Cleanup(Close)

	Init("info")
	Info().Msg("stdout-only test")

	if fileSink != nil {
		t.Error("expected fileSink to be nil when LOG_FILE_PATH is empty")
	}
}

func TestCloseCanBeCalledMultipleTimes(t *testing.T) {
	Init("info")

	Close()
	Close()
}

