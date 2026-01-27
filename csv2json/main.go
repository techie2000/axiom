package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/spf13/cobra"
)

var (
	inputFile   string
	domain      string
	entity      string
	rabbitMQURL string
	exchange    string
)

// MessageEnvelope wraps the CSV data in a standard message format
type MessageEnvelope struct {
	Domain    string                 `json:"domain"` // e.g., "reference"
	Entity    string                 `json:"entity"` // e.g., "countries"
	Timestamp time.Time              `json:"timestamp"`
	Source    string                 `json:"source"`  // always "csv2json"
	Payload   map[string]interface{} `json:"payload"` // CSV row as JSON
}

var rootCmd = &cobra.Command{
	Use:   "csv2json",
	Short: "Convert CSV files to JSON messages for RabbitMQ",
	Long: `csv2json is a format-only converter that reads CSV files and publishes
each row as a JSON message to RabbitMQ. It performs NO data transformation or
validation - that is the responsibility of the canonicalizer service.`,
	RunE: run,
}

func init() {
	rootCmd.Flags().StringVarP(&inputFile, "input", "i", "", "Input CSV file path (required)")
	rootCmd.Flags().StringVarP(&domain, "domain", "d", "", "Domain (e.g., 'reference') (required)")
	rootCmd.Flags().StringVarP(&entity, "entity", "e", "", "Entity (e.g., 'countries') (required)")
	rootCmd.Flags().StringVar(&rabbitMQURL, "rabbitmq-url", getEnv("RABBITMQ_URL", "amqp://axiom:changeme@localhost:5672/axiom"), "RabbitMQ connection URL")
	rootCmd.Flags().StringVar(&exchange, "exchange", getEnv("RABBITMQ_EXCHANGE", "axiom.data.exchange"), "RabbitMQ exchange name")

	rootCmd.MarkFlagRequired("input")
	rootCmd.MarkFlagRequired("domain")
	rootCmd.MarkFlagRequired("entity")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func run(cmd *cobra.Command, args []string) error {
	log.Printf("csv2json starting: %s -> %s.%s", inputFile, domain, entity)

	// Open CSV file
	file, err := os.Open(inputFile)
	if err != nil {
		return fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	// Parse CSV
	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	// Read header row
	headers, err := reader.Read()
	if err != nil {
		return fmt.Errorf("failed to read CSV headers: %w", err)
	}

	log.Printf("CSV headers: %v", headers)

	// Connect to RabbitMQ
	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}
	defer conn.Close()

	channel, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("failed to open channel: %w", err)
	}
	defer channel.Close()

	// Declare exchange (idempotent)
	err = channel.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	// Generate routing key: domain.entity (e.g., "reference.countries")
	routingKey := fmt.Sprintf("%s.%s", domain, entity)
	log.Printf("Publishing to exchange '%s' with routing key '%s'", exchange, routingKey)

	// Process each CSV row
	rowCount := 0
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read CSV row: %w", err)
		}

		// Convert row to map[string]interface{}
		// CRITICAL: This is format-only conversion - NO transformation
		rowData := make(map[string]interface{})
		for i, value := range row {
			if i < len(headers) {
				rowData[headers[i]] = value // Store exactly as-is
			}
		}

		// Wrap in message envelope
		envelope := MessageEnvelope{
			Domain:    domain,
			Entity:    entity,
			Timestamp: time.Now().UTC(),
			Source:    "csv2json",
			Payload:   rowData,
		}

		// Marshal to JSON
		body, err := json.Marshal(envelope)
		if err != nil {
			return fmt.Errorf("failed to marshal message: %w", err)
		}

		// Publish to RabbitMQ
		err = channel.Publish(
			exchange,   // exchange
			routingKey, // routing key
			false,      // mandatory
			false,      // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
				Timestamp:   time.Now(),
			},
		)
		if err != nil {
			return fmt.Errorf("failed to publish message: %w", err)
		}

		rowCount++
		if rowCount%100 == 0 {
			log.Printf("Processed %d rows...", rowCount)
		}
	}

	log.Printf("✓ Successfully processed %d rows from %s", rowCount, inputFile)
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
