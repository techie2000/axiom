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

func TestInitFallsBackToStdoutOnInvalidLogPath(t *testing.T) {
	invalidPath := t.TempDir()
	t.Setenv("LOG_FILE_PATH", invalidPath)
	t.Cleanup(Close)

	Init("info")
	Info().Msg("logger fallback test")
}
