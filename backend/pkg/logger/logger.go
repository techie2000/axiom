package logger

import (
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gopkg.in/natefinch/lumberjack.v2"
)

var logger zerolog.Logger
var fileSink io.Closer

func Close() {
	if fileSink != nil {
		if err := fileSink.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "logger: failed to close log file: %v\n", err)
		}
		fileSink = nil
	}
}

// envInt reads an integer environment variable, returning fallback when unset or invalid.
func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
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
		lb := &lumberjack.Logger{
			Filename:   logFilePath,
			MaxSize:    envInt("LOG_MAX_SIZE_MB", 10),
			MaxBackups: envInt("LOG_MAX_BACKUPS", 3),
			MaxAge:     envInt("LOG_MAX_AGE_DAYS", 7),
			Compress:   strings.EqualFold(strings.TrimSpace(os.Getenv("LOG_COMPRESS")), "true"),
		}
		fileSink = lb
		output = io.MultiWriter(os.Stdout, lb)
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
