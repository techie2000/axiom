package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/techie2000/axiom/modules/reference/countries/pkg/repository"
	"github.com/techie2000/axiom/modules/reference/countries/pkg/transform"
)

// Version is set at build time via ldflags or read from VERSION file
var Version = "dev"

// Log level constants
type LogLevel string

const (
	LogLevelINFO  LogLevel = "INFO"
	LogLevelWARN  LogLevel = "WARN"
	LogLevelERROR LogLevel = "ERROR"
)

// logWithLevel logs a message with severity level
func logWithLevel(level LogLevel, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("%s: %s", level, msg)
}

// logInfo logs an informational message
func logInfo(format string, args ...interface{}) {
	logWithLevel(LogLevelINFO, format, args...)
}

// logWarn logs a warning message
func logWarn(format string, args ...interface{}) {
	logWithLevel(LogLevelWARN, format, args...)
}

// logError logs an error message
func logError(format string, args ...interface{}) {
	logWithLevel(LogLevelERROR, format, args...)
}

func init() {
	// If version wasn't set at build time, try to read from VERSION file
	if Version == "dev" {
		if versionBytes, err := os.ReadFile("VERSION"); err == nil {
			Version = strings.TrimSpace(string(versionBytes))
		}
	}
}

// Config holds canonicalizer configuration
type Config struct {
	// Database
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string

	// RabbitMQ
	RabbitMQHost     string
	RabbitMQPort     string
	RabbitMQUser     string
	RabbitMQPassword string
	RabbitMQVHost    string
	RabbitMQExchange string

	// Logging
	EnableFileLogging bool
	LogFilePath       string
}

// MessageEnvelope represents the message from csv2json
type MessageEnvelope struct {
	Domain    string          `json:"domain"`
	Entity    string          `json:"entity"`
	Timestamp time.Time       `json:"timestamp"`
	Source    string          `json:"source"`
	Payload   json.RawMessage `json:"payload"`
}

func main() {
	// Load configuration
	config := loadConfig()

	// Setup service-level logging (stdout + file)
	var serviceLogFile *os.File
	if config.EnableFileLogging {
		var err error
		serviceLogFile, err = os.OpenFile(config.LogFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			log.Printf("WARN: Failed to open service log file %s: %v", config.LogFilePath, err)
		} else {
			// Set default logger to write to both stdout and service log file
			log.SetOutput(io.MultiWriter(os.Stdout, serviceLogFile))
			logInfo("Service logging enabled: %s", config.LogFilePath)
			defer serviceLogFile.Close()
		}
	}

	logInfo("Canonicalizer v%s starting...", Version)

	// Connect to PostgreSQL
	db, err := connectDB(config)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	logInfo("✓ Connected to PostgreSQL")

	// Connect to RabbitMQ
	// RabbitMQ vhost encoding: vhost "/axiom" must become "/%2Faxiom" in the URL
	// The "/" in the vhost name needs to be URL-encoded as %2F
	vhostPath := strings.ReplaceAll(config.RabbitMQVHost, "/", "%2F")
	if !strings.HasPrefix(vhostPath, "/") {
		vhostPath = "/" + vhostPath
	}
	rabbitURL := fmt.Sprintf("amqp://%s:%s@%s:%s%s",
		config.RabbitMQUser,
		config.RabbitMQPassword,
		config.RabbitMQHost,
		config.RabbitMQPort,
		vhostPath,
	)

	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	channel, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open channel: %v", err)
	}
	defer channel.Close()

	logInfo("✓ Connected to RabbitMQ")

	// Declare main exchange (idempotent)
	err = channel.ExchangeDeclare(
		config.RabbitMQExchange, // name
		"topic",                 // type
		true,                    // durable
		false,                   // auto-deleted
		false,                   // internal
		false,                   // no-wait
		nil,                     // arguments
	)
	if err != nil {
		log.Fatalf("Failed to declare exchange: %v", err)
	}

	// Declare Dead Letter Exchange (DLX)
	dlxName := "axiom.data.dlx"
	err = channel.ExchangeDeclare(
		dlxName, // name
		"topic", // type
		true,    // durable
		false,   // auto-deleted
		false,   // internal
		false,   // no-wait
		nil,     // arguments
	)
	if err != nil {
		log.Fatalf("Failed to declare DLX: %v", err)
	}
	logInfo("✓ Dead Letter Exchange '%s' declared", dlxName)

	// Declare Dead Letter Queue (DLQ) for countries
	dlqName := "axiom.reference.countries.dlq"
	dlqQueue, err := channel.QueueDeclare(
		dlqName, // name
		true,    // durable
		false,   // delete when unused
		false,   // exclusive
		false,   // no-wait
		nil,     // arguments (no further DLX for DLQ itself)
	)
	if err != nil {
		log.Fatalf("Failed to declare DLQ: %v", err)
	}

	// Bind DLQ to DLX
	err = channel.QueueBind(
		dlqQueue.Name,         // queue name
		"reference.countries", // routing key (must match the x-dead-letter-routing-key)
		dlxName,               // exchange (the DLX)
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind DLQ to DLX: %v", err)
	}
	logInfo("✓ Dead Letter Queue '%s' bound to DLX with routing key 'reference.countries'", dlqName)

	// Declare queue for countries with DLX
	queueName := "axiom.reference.countries"
	queueArgs := amqp.Table{
		"x-dead-letter-exchange":    "axiom.data.dlx",
		"x-dead-letter-routing-key": "reference.countries",
	}
	queue, err := channel.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		queueArgs, // arguments with DLX
	)
	if err != nil {
		log.Fatalf("Failed to declare queue: %v", err)
	}

	// Bind queue to exchange
	err = channel.QueueBind(
		queue.Name,              // queue name
		"reference.countries",   // routing key
		config.RabbitMQExchange, // exchange
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind queue: %v", err)
	}

	logInfo("✓ Queue '%s' bound to exchange '%s' with routing key 'reference.countries'",
		queueName, config.RabbitMQExchange)

	// Set QoS
	err = channel.Qos(
		1,     // prefetch count
		0,     // prefetch size
		false, // global
	)
	if err != nil {
		log.Fatalf("Failed to set QoS: %v", err)
	}

	// Start consuming
	msgs, err := channel.Consume(
		queue.Name, // queue
		"",         // consumer
		false,      // auto-ack
		false,      // exclusive
		false,      // no-local
		false,      // no-wait
		nil,        // args
	)
	if err != nil {
		log.Fatalf("Failed to register consumer: %v", err)
	}

	logInfo("✓ Canonicalizer ready - waiting for messages...")

	// Create repository
	repo := repository.NewCountryRepository(db)

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		logInfo("Shutdown signal received, stopping...")
		cancel()
	}()

	// Process messages
	processedCount := 0
	skippedCount := 0
	rejectedCount := 0

	for {
		select {
		case <-ctx.Done():
			logInfo("Shutting down - processed: %d, skipped: %d, rejected: %d", processedCount, skippedCount, rejectedCount)
			return

		case msg, ok := <-msgs:
			if !ok {
				logInfo("Channel closed")
				return
			}

			result := processMessage(ctx, msg.Body, repo)
			if result.Error != nil {
				// Publish to DLQ with error information in headers
				dlqHeaders := amqp.Table{
					"x-original-exchange":    config.RabbitMQExchange,
					"x-original-routing-key": "reference.countries",
					"x-rejection-reason":     result.Error.Error(),
					"x-rejected-at":          time.Now().UTC().Format(time.RFC3339),
				}

				// Publish directly to DLQ with error context
				err := channel.Publish(
					"axiom.data.dlx",      // exchange (DLX)
					"reference.countries", // routing key
					false,                 // mandatory
					false,                 // immediate
					amqp.Publishing{
						ContentType:  "application/json",
						Body:         msg.Body,
						Headers:      dlqHeaders,
						DeliveryMode: amqp.Persistent,
					},
				)
				if err != nil {
					logError("Failed to publish to DLQ: %v", err)
					msg.Nack(false, true) // Requeue on publish failure
				} else {
					logError("✗ Rejected: %v", result.Error)
					msg.Ack(false) // Ack original message after successful DLQ publish
				}
				rejectedCount++
			} else if result.Skipped {
				msg.Ack(false) // Ack skipped messages (not errors)
				skippedCount++
				logWarn("⊘ Skipped: %s - %s", result.Alpha2, result.SkipReason)
			} else {
				msg.Ack(false)
				processedCount++
			}

			if (processedCount+skippedCount)%10 == 0 && (processedCount+skippedCount) > 0 {
				logInfo("Progress: processed=%d, skipped=%d, rejected=%d", processedCount, skippedCount, rejectedCount)
			}
		}
	}
}

// ProcessResult encapsulates the result of processing a message
type ProcessResult struct {
	Error      error
	Skipped    bool
	SkipReason string
	Alpha2     string
}

func processMessage(ctx context.Context, body []byte, repo *repository.CountryRepository) ProcessResult {
	// Parse envelope
	var envelope MessageEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return ProcessResult{Error: fmt.Errorf("failed to unmarshal envelope: %w", err)}
	}

	// Validate envelope
	if envelope.Domain != "reference" || envelope.Entity != "countries" {
		return ProcessResult{Error: fmt.Errorf("invalid domain/entity: %s/%s", envelope.Domain, envelope.Entity)}
	}

	// Parse raw country data (from csv2json)
	var rawCountry transform.RawCountryData
	if err := json.Unmarshal(envelope.Payload, &rawCountry); err != nil {
		return ProcessResult{Error: fmt.Errorf("failed to unmarshal payload: %w", err)}
	}

	// Apply ALL canonicalizer transformation rules
	country, err := transform.TransformToCountry(rawCountry)
	if err != nil {
		// Check if this is a formerly_used code that should be skipped
		if errors.Is(err, transform.ErrFormerlyUsedSkipped) {
			return ProcessResult{
				Skipped:    true,
				SkipReason: "formerly_used status per ADR-007",
				Alpha2:     strings.ToUpper(strings.TrimSpace(rawCountry.Alpha2Code)),
			}
		}
		return ProcessResult{Error: fmt.Errorf("transformation failed: %w", err)}
	}

	// Set audit trail context (source tracking for provenance)
	if _, err := repo.SetAuditContext(ctx, envelope.Source, "canonicalizer"); err != nil {
		logWarn("Failed to set audit context: %v", err)
	}

	// Upsert to database
	if err := repo.Upsert(ctx, country); err != nil {
		return ProcessResult{Error: fmt.Errorf("database upsert failed: %w", err)}
	}

	logInfo("✓ Processed: %s (%s)", country.Alpha2, country.NameEnglish)
	return ProcessResult{}
}

func loadConfig() Config {
	enableFileLogging := getEnv("ENABLE_FILE_LOGGING", "true") == "true"
	logFilePath := getEnv("LOG_FILE_PATH", "./data/canonicalizer.log")

	return Config{
		DBHost:            getEnv("DB_HOST", "localhost"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBName:            getEnv("DB_NAME", "axiom_db"),
		DBUser:            getEnv("DB_USER", "axiom"),
		DBPassword:        getEnv("DB_PASSWORD", "changeme"),
		DBSSLMode:         getEnv("DB_SSLMODE", "disable"),
		RabbitMQHost:      getEnv("RABBITMQ_HOST", "localhost"),
		RabbitMQPort:      getEnv("RABBITMQ_PORT", "5672"),
		RabbitMQUser:      getEnv("RABBITMQ_USER", "axiom"),
		RabbitMQPassword:  getEnv("RABBITMQ_PASSWORD", "changeme"),
		RabbitMQVHost:     getEnv("RABBITMQ_VHOST", "/axiom"),
		RabbitMQExchange:  getEnv("RABBITMQ_EXCHANGE", "axiom.data.exchange"),
		EnableFileLogging: enableFileLogging,
		LogFilePath:       logFilePath,
	}
}

func connectDB(config Config) (*sql.DB, error) {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		config.DBHost,
		config.DBPort,
		config.DBUser,
		config.DBPassword,
		config.DBName,
		config.DBSSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return db, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
