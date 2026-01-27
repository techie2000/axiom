package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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
	log.Println("Canonicalizer starting...")

	// Load configuration
	config := loadConfig()

	// Connect to PostgreSQL
	db, err := connectDB(config)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("✓ Connected to PostgreSQL")

	// Connect to RabbitMQ
	rabbitURL := fmt.Sprintf("amqp://%s:%s@%s:%s%s",
		config.RabbitMQUser,
		config.RabbitMQPassword,
		config.RabbitMQHost,
		config.RabbitMQPort,
		config.RabbitMQVHost,
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

	log.Println("✓ Connected to RabbitMQ")

	// Declare exchange (idempotent)
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

	// Declare queue for countries
	queueName := "axiom.reference.countries"
	queue, err := channel.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
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

	log.Printf("✓ Queue '%s' bound to exchange '%s' with routing key 'reference.countries'",
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

	log.Println("✓ Canonicalizer ready - waiting for messages...")

	// Create repository
	repo := repository.NewCountryRepository(db)

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutdown signal received, stopping...")
		cancel()
	}()

	// Process messages
	processedCount := 0
	skippedCount := 0
	rejectedCount := 0

	for {
		select {
		case <-ctx.Done():
			log.Printf("Shutting down - processed: %d, skipped: %d, rejected: %d", processedCount, skippedCount, rejectedCount)
			return

		case msg, ok := <-msgs:
			if !ok {
				log.Println("Channel closed")
				return
			}

			result := processMessage(ctx, msg.Body, repo)
			if result.Error != nil {
				log.Printf("✗ Failed to process message: %v", result.Error)
				msg.Nack(false, false) // Don't requeue - send to DLX
				rejectedCount++
			} else if result.Skipped {
				msg.Ack(false) // Ack skipped messages (not errors)
				skippedCount++
				log.Printf("⊘ Skipped: %s - %s", result.Alpha2, result.SkipReason)
			} else {
				msg.Ack(false)
				processedCount++
			}

			if (processedCount+skippedCount)%10 == 0 && (processedCount+skippedCount) > 0 {
				log.Printf("Progress: processed=%d, skipped=%d, rejected=%d", processedCount, skippedCount, rejectedCount)
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
		log.Printf("Warning: Failed to set audit context: %v", err)
	}

	// Upsert to database
	if err := repo.Upsert(ctx, country); err != nil {
		return ProcessResult{Error: fmt.Errorf("database upsert failed: %w", err)}
	}

	log.Printf("✓ Processed: %s (%s)", country.Alpha2, country.NameEnglish)
	return ProcessResult{}
}

func loadConfig() Config {
	return Config{
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBName:           getEnv("DB_NAME", "axiom_db"),
		DBUser:           getEnv("DB_USER", "axiom"),
		DBPassword:       getEnv("DB_PASSWORD", "changeme"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		RabbitMQHost:     getEnv("RABBITMQ_HOST", "localhost"),
		RabbitMQPort:     getEnv("RABBITMQ_PORT", "5672"),
		RabbitMQUser:     getEnv("RABBITMQ_USER", "axiom"),
		RabbitMQPassword: getEnv("RABBITMQ_PASSWORD", "changeme"),
		RabbitMQVHost:    getEnv("RABBITMQ_VHOST", "/axiom"),
		RabbitMQExchange: getEnv("RABBITMQ_EXCHANGE", "axiom.data.exchange"),
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
