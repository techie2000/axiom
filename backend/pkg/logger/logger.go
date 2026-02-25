package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var logger zerolog.Logger
var fileSink *os.File

func Close() {
	if fileSink != nil {
		if err := fileSink.Sync(); err != nil {
			fmt.Fprintf(os.Stderr, "logger: failed to sync log file: %v\n", err)
		}
		if err := fileSink.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "logger: failed to close log file: %v\n", err)
		}
		fileSink = nil
	}
}

// Init initializes the logger
func Init(level string) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	Close()

	logLevel := zerolog.InfoLevel
	switch level {
	case "debug":
		logLevel = zerolog.DebugLevel
	case "warn":
		logLevel = zerolog.WarnLevel
	case "error":
		logLevel = zerolog.ErrorLevel
	}

	output := io.Writer(os.Stdout)
	logFilePath := strings.TrimSpace(os.Getenv("LOG_FILE_PATH"))
	if logFilePath != "" {
		if err := os.MkdirAll(filepath.Dir(logFilePath), 0755); err != nil {
			fmt.Fprintf(os.Stderr, "logger: failed to create log directory for %s: %v\n", logFilePath, err)
		} else {
			file, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				fmt.Fprintf(os.Stderr, "logger: failed to open log file %s: %v\n", logFilePath, err)
			} else {
				fileSink = file
				output = io.MultiWriter(os.Stdout, file)
			}
		}
	}

	logger = zerolog.New(output).
		Level(logLevel).
		With().
		Timestamp().
		Caller().
		Logger()

	log.Logger = logger
}

// Debug returns a debug level event
func Debug() *zerolog.Event {
	return logger.Debug()
}

// Info returns an info level event
func Info() *zerolog.Event {
	return logger.Info()
}

// Warn returns a warn level event
func Warn() *zerolog.Event {
	return logger.Warn()
}

// Error returns an error level event
func Error() *zerolog.Event {
	return logger.Error()
}

// Fatal returns a fatal level event
func Fatal() *zerolog.Event {
	return logger.Fatal()
}
