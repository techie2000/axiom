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
	countryrepo "github.com/techie2000/axiom/modules/reference/countries/pkg/repository"
	countrytransform "github.com/techie2000/axiom/modules/reference/countries/pkg/transform"
	currencyrepo "github.com/techie2000/axiom/modules/reference/currencies/pkg/repository"
	currencytransform "github.com/techie2000/axiom/modules/reference/currencies/pkg/transform"
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

	// ========================================
	// Setup for COUNTRIES
	// ========================================

	// Declare Dead Letter Queue (DLQ) for countries
	dlqCountriesName := "axiom.reference.countries.dlq"
	dlqCountriesQueue, err := channel.QueueDeclare(
		dlqCountriesName, // name
		true,             // durable
		false,            // delete when unused
		false,            // exclusive
		false,            // no-wait
		nil,              // arguments (no further DLX for DLQ itself)
	)
	if err != nil {
		log.Fatalf("Failed to declare countries DLQ: %v", err)
	}

	// Bind countries DLQ to DLX
	err = channel.QueueBind(
		dlqCountriesQueue.Name, // queue name
		"reference.countries",  // routing key (must match the x-dead-letter-routing-key)
		dlxName,                // exchange (the DLX)
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind countries DLQ to DLX: %v", err)
	}
	logInfo("✓ Dead Letter Queue '%s' bound to DLX with routing key 'reference.countries'", dlqCountriesName)

	// Declare main queue for countries with DLX
	queueCountriesName := "axiom.reference.countries"
	queueCountriesArgs := amqp.Table{
		"x-dead-letter-exchange":    dlxName,
		"x-dead-letter-routing-key": "reference.countries",
	}
	queueCountries, err := channel.QueueDeclare(
		queueCountriesName, // name
		true,               // durable
		false,              // delete when unused
		false,              // exclusive
		false,              // no-wait
		queueCountriesArgs, // arguments with DLX
	)
	if err != nil {
		log.Fatalf("Failed to declare countries queue: %v", err)
	}

	// Bind countries queue to exchange
	err = channel.QueueBind(
		queueCountries.Name,     // queue name
		"reference.countries",   // routing key
		config.RabbitMQExchange, // exchange
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind countries queue: %v", err)
	}

	logInfo("✓ Queue '%s' bound to exchange '%s' with routing key 'reference.countries'",
		queueCountriesName, config.RabbitMQExchange)

	// ========================================
	// Setup for CURRENCIES
	// ========================================

	// Declare Dead Letter Queue (DLQ) for currencies
	dlqCurrenciesName := "axiom.reference.currencies.dlq"
	dlqCurrenciesQueue, err := channel.QueueDeclare(
		dlqCurrenciesName, // name
		true,              // durable
		false,             // delete when unused
		false,             // exclusive
		false,             // no-wait
		nil,               // arguments
	)
	if err != nil {
		log.Fatalf("Failed to declare currencies DLQ: %v", err)
	}

	// Bind currencies DLQ to DLX
	err = channel.QueueBind(
		dlqCurrenciesQueue.Name, // queue name
		"reference.currencies",  // routing key
		dlxName,                 // exchange
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind currencies DLQ to DLX: %v", err)
	}
	logInfo("✓ Dead Letter Queue '%s' bound to DLX with routing key 'reference.currencies'", dlqCurrenciesName)

	// Declare main queue for currencies with DLX
	queueCurrenciesName := "axiom.reference.currencies"
	queueCurrenciesArgs := amqp.Table{
		"x-dead-letter-exchange":    dlxName,
		"x-dead-letter-routing-key": "reference.currencies",
	}
	queueCurrencies, err := channel.QueueDeclare(
		queueCurrenciesName, // name
		true,                // durable
		false,               // delete when unused
		false,               // exclusive
		false,               // no-wait
		queueCurrenciesArgs, // arguments with DLX
	)
	if err != nil {
		log.Fatalf("Failed to declare currencies queue: %v", err)
	}

	// Bind currencies queue to exchange
	err = channel.QueueBind(
		queueCurrencies.Name,    // queue name
		"reference.currencies",  // routing key
		config.RabbitMQExchange, // exchange
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to bind currencies queue: %v", err)
	}

	logInfo("✓ Queue '%s' bound to exchange '%s' with routing key 'reference.currencies'",
		queueCurrenciesName, config.RabbitMQExchange)

	// ========================================
	// Consumer Setup
	// ========================================

	// Set QoS
	err = channel.Qos(
		1,     // prefetch count
		0,     // prefetch size
		false, // global
	)
	if err != nil {
		log.Fatalf("Failed to set QoS: %v", err)
	}

	// Start consuming from countries queue
	countriesMsgs, err := channel.Consume(
		queueCountries.Name,  // queue
		"countries-consumer", // consumer tag
		false,                // auto-ack
		false,                // exclusive
		false,                // no-local
		false,                // no-wait
		nil,                  // args
	)
	if err != nil {
		log.Fatalf("Failed to register countries consumer: %v", err)
	}

	// Start consuming from currencies queue
	currenciesMsgs, err := channel.Consume(
		queueCurrencies.Name,  // queue
		"currencies-consumer", // consumer tag
		false,                 // auto-ack
		false,                 // exclusive
		false,                 // no-local
		false,                 // no-wait
		nil,                   // args
	)
	if err != nil {
		log.Fatalf("Failed to register currencies consumer: %v", err)
	}

	logInfo("✓ Canonicalizer ready - waiting for messages from countries and currencies queues...")

	// Create repositories
	countryRepo := countryrepo.NewCountryRepository(db)
	currencyRepo := currencyrepo.NewCurrencyRepository(db)

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

	// Process messages from both queues
	countriesProcessed := 0
	countriesSkipped := 0
	countriesRejected := 0
	currenciesProcessed := 0
	currenciesRejected := 0

	for {
		select {
		case <-ctx.Done():
			logInfo("Shutting down - countries: processed=%d, skipped=%d, rejected=%d; currencies: processed=%d, rejected=%d",
				countriesProcessed, countriesSkipped, countriesRejected, currenciesProcessed, currenciesRejected)
			return

		case msg, ok := <-countriesMsgs:
			if !ok {
				logInfo("Countries channel closed")
				return
			}

			result := processCountryMessage(ctx, msg.Body, countryRepo, channel, config.RabbitMQExchange)
			msg.Ack(false)

			if result.Error != nil {
				countriesRejected++
			} else if result.Skipped {
				countriesSkipped++
				logWarn("⊘ Skipped: %s - %s", result.Alpha2, result.SkipReason)
			} else {
				countriesProcessed++
			}

			if (countriesProcessed+countriesSkipped)%10 == 0 && (countriesProcessed+countriesSkipped) > 0 {
				logInfo("Countries progress: processed=%d, skipped=%d, rejected=%d", countriesProcessed, countriesSkipped, countriesRejected)
			}

		case msg, ok := <-currenciesMsgs:
			if !ok {
				logInfo("Currencies channel closed")
				return
			}

			result := processCurrencyMessage(ctx, msg.Body, currencyRepo, channel, config.RabbitMQExchange)
			msg.Ack(false)

			if result.Error != nil {
				currenciesRejected++
			} else {
				currenciesProcessed++
			}

			if currenciesProcessed%10 == 0 && currenciesProcessed > 0 {
				logInfo("Currencies progress: processed=%d, rejected=%d", currenciesProcessed, currenciesRejected)
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

func processMessage(ctx context.Context, body []byte, repo *countryrepo.CountryRepository) ProcessResult {
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
	var rawCountry countrytransform.RawCountryData
	if err := json.Unmarshal(envelope.Payload, &rawCountry); err != nil {
		return ProcessResult{Error: fmt.Errorf("failed to unmarshal payload: %w", err)}
	}

	// Apply ALL canonicalizer transformation rules
	country, err := countrytransform.TransformToCountry(rawCountry)
	if err != nil {
		// Check if this is a formerly_used code that should be skipped
		if errors.Is(err, countrytransform.ErrFormerlyUsedSkipped) {
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

	logInfo("[COUNTRIES] ✓ Processed: %s (%s)", country.Alpha2, country.NameEnglish)
	return ProcessResult{}
}

// processCountryMessage processes country messages (keeping for backwards compatibility)
func processCountryMessage(ctx context.Context, body []byte, repo *countryrepo.CountryRepository, channel *amqp.Channel, exchange string) ProcessResult {
	result := processMessage(ctx, body, repo)
	if result.Error != nil {
		// Publish to DLQ with error information
		dlqHeaders := amqp.Table{
			"x-original-exchange":    exchange,
			"x-original-routing-key": "reference.countries",
			"x-rejection-reason":     result.Error.Error(),
			"x-rejected-at":          time.Now().UTC().Format(time.RFC3339),
		}

		err := channel.Publish(
			"axiom.data.dlx",      // exchange (DLX)
			"reference.countries", // routing key
			false,                 // mandatory
			false,                 // immediate
			amqp.Publishing{
				ContentType:  "application/json",
				Body:         body,
				Headers:      dlqHeaders,
				DeliveryMode: amqp.Persistent,
			},
		)
		if err != nil {
			logError("Failed to publish to DLQ: %v", err)
		} else {
			logError("[COUNTRIES] ✗ Rejected: %v", result.Error)
		}
	}
	return result
}

// processCurrencyMessage processes currency messages from RabbitMQ
func processCurrencyMessage(ctx context.Context, body []byte, repo *currencyrepo.CurrencyRepository, channel *amqp.Channel, exchange string) ProcessResult {
	// Parse envelope
	var envelope MessageEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return ProcessResult{Error: fmt.Errorf("failed to unmarshal envelope: %w", err)}
	}

	// Validate envelope
	if envelope.Domain != "reference" || envelope.Entity != "currencies" {
		return ProcessResult{Error: fmt.Errorf("invalid domain/entity: %s/%s", envelope.Domain, envelope.Entity)}
	}

	// Parse raw currency data (from csv2json)
	var rawCurrency currencytransform.RawCurrencyData
	if err := json.Unmarshal(envelope.Payload, &rawCurrency); err != nil {
		return ProcessResult{Error: fmt.Errorf("failed to unmarshal payload: %w", err)}
	}

	// Apply ALL canonicalizer transformation rules
	currency, err := currencytransform.TransformToCurrency(rawCurrency)
	if err != nil {
		// Publish to DLQ with error information
		dlqHeaders := amqp.Table{
			"x-original-exchange":    exchange,
			"x-original-routing-key": "reference.currencies",
			"x-rejection-reason":     err.Error(),
			"x-rejected-at":          time.Now().UTC().Format(time.RFC3339),
		}

		pubErr := channel.Publish(
			"axiom.data.dlx",       // exchange (DLX)
			"reference.currencies", // routing key
			false,                  // mandatory
			false,                  // immediate
			amqp.Publishing{
				ContentType:  "application/json",
				Body:         body,
				Headers:      dlqHeaders,
				DeliveryMode: amqp.Persistent,
			},
		)
		if pubErr != nil {
			logError("Failed to publish to DLQ: %v", pubErr)
		} else {
			logError("✗ Rejected: %v", err)
		}
		return ProcessResult{Error: fmt.Errorf("transformation failed: %w", err)}
	}

	// Set audit trail context (source tracking for provenance)
	if _, err := repo.SetAuditContext(ctx, envelope.Source, "canonicalizer"); err != nil {
		logWarn("Failed to set audit context: %v", err)
	}

	// Upsert to database
	if err := repo.Upsert(ctx, currency); err != nil {
		// Publish to DLQ
		dlqHeaders := amqp.Table{
			"x-original-exchange":    exchange,
			"x-original-routing-key": "reference.currencies",
			"x-rejection-reason":     err.Error(),
			"x-rejected-at":          time.Now().UTC().Format(time.RFC3339),
		}

		pubErr := channel.Publish(
			"axiom.data.dlx",       // exchange (DLX)
			"reference.currencies", // routing key
			false,                  // mandatory
			false,                  // immediate
			amqp.Publishing{
				ContentType:  "application/json",
				Body:         body,
				Headers:      dlqHeaders,
				DeliveryMode: amqp.Persistent,
			},
		)
		if pubErr != nil {
			logError("Failed to publish to DLQ: %v", pubErr)
		} else {
			logError("[CURRENCIES] ✗ Rejected: %v", err)
		}
		return ProcessResult{Error: fmt.Errorf("database upsert failed: %w", err)}
	}

	logInfo("[CURRENCIES] ✓ Processed: %s (%s)", currency.Code, currency.Name)
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
