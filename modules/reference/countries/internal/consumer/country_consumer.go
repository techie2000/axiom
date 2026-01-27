package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/techie2000/axiom/modules/reference/countries/pkg/repository"
	"github.com/techie2000/axiom/modules/reference/countries/pkg/transform"
)

// CountryConsumer handles RabbitMQ messages for country data
type CountryConsumer struct {
	conn       *amqp.Connection
	channel    *amqp.Channel
	queueName  string
	repository *repository.CountryRepository
}

// MessageEnvelope represents the standard message format from canonicalizer
type MessageEnvelope struct {
	Domain    string          `json:"domain"` // e.g., "reference"
	Entity    string          `json:"entity"` // e.g., "countries"
	Timestamp time.Time       `json:"timestamp"`
	Source    string          `json:"source"`  // e.g., "csv2json"
	Payload   json.RawMessage `json:"payload"` // Country data
}

// NewCountryConsumer creates a new RabbitMQ consumer
func NewCountryConsumer(connURL, queueName string, repo *repository.CountryRepository) (*CountryConsumer, error) {
	conn, err := amqp.Dial(connURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare queue (idempotent)
	_, err = channel.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		nil,       // arguments
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	// Set QoS to process one message at a time
	err = channel.Qos(
		1,     // prefetch count
		0,     // prefetch size
		false, // global
	)
	if err != nil {
		channel.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to set QoS: %w", err)
	}

	return &CountryConsumer{
		conn:       conn,
		channel:    channel,
		queueName:  queueName,
		repository: repo,
	}, nil
}

// Start begins consuming messages from the queue
func (c *CountryConsumer) Start(ctx context.Context) error {
	msgs, err := c.channel.Consume(
		c.queueName, // queue
		"",          // consumer tag (auto-generated)
		false,       // auto-ack (we'll manually ack)
		false,       // exclusive
		false,       // no-local
		false,       // no-wait
		nil,         // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	log.Printf("Started consuming from queue: %s", c.queueName)

	for {
		select {
		case <-ctx.Done():
			log.Println("Consumer stopping due to context cancellation")
			return ctx.Err()

		case msg, ok := <-msgs:
			if !ok {
				return fmt.Errorf("message channel closed")
			}

			if err := c.processMessage(ctx, msg); err != nil {
				log.Printf("Error processing message: %v", err)
				// Reject and requeue message
				msg.Nack(false, true)
			} else {
				// Acknowledge successful processing
				msg.Ack(false)
			}
		}
	}
}

// processMessage handles a single message from the queue
func (c *CountryConsumer) processMessage(ctx context.Context, msg amqp.Delivery) error {
	// Parse message envelope
	var envelope MessageEnvelope
	if err := json.Unmarshal(msg.Body, &envelope); err != nil {
		return fmt.Errorf("failed to unmarshal envelope: %w", err)
	}

	// Validate envelope
	if envelope.Domain != "reference" || envelope.Entity != "countries" {
		return fmt.Errorf("invalid message domain/entity: %s/%s", envelope.Domain, envelope.Entity)
	}

	// Parse raw country payload (from csv2json)
	var rawCountry transform.RawCountryData
	if err := json.Unmarshal(envelope.Payload, &rawCountry); err != nil {
		return fmt.Errorf("failed to unmarshal country: %w", err)
	}

	// Apply all canonicalizer transformation rules
	country, err := transform.TransformToCountry(rawCountry)
	if err != nil {
		return fmt.Errorf("transformation failed: %w", err)
	}

	// Upsert to database
	if err := c.repository.Upsert(ctx, country); err != nil {
		return fmt.Errorf("failed to save country: %w", err)
	}

	log.Printf("Processed country: %s (%s)", country.Alpha2, country.NameEnglish)
	return nil
}

// Close cleanly shuts down the consumer
func (c *CountryConsumer) Close() error {
	if c.channel != nil {
		if err := c.channel.Close(); err != nil {
			log.Printf("Error closing channel: %v", err)
		}
	}
	if c.conn != nil {
		if err := c.conn.Close(); err != nil {
			log.Printf("Error closing connection: %v", err)
		}
	}
	return nil
}
