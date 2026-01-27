package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	amqp "github.com/rabbitmq/amqp091-go"
)

// Version is set at build time via ldflags or read from VERSION file
var Version = "dev"

func init() {
	// If version wasn't set at build time, try to read from VERSION file
	if Version == "dev" {
		if versionBytes, err := os.ReadFile("VERSION"); err == nil {
			Version = strings.TrimSpace(string(versionBytes))
		}
	}
}

type RouteConfig struct {
	Name              string        `json:"name"`
	IngestionContract string        `json:"ingestionContract"`
	Domain            string        `json:"domain"`
	Entity            string        `json:"entity"`
	Input             InputConfig   `json:"input"`
	Output            OutputConfig  `json:"output"`
	Archive           ArchiveConfig `json:"archive"`
	Logging           LogConfig     `json:"logging"`
	logFile           *os.File      // Log file handle for this route
	logger            *log.Logger   // Route-specific logger
}

// Log level constants
type LogLevel string

const (
	LogLevelINFO  LogLevel = "INFO"
	LogLevelWARN  LogLevel = "WARN"
	LogLevelERROR LogLevel = "ERROR"
)

// Logf logs a message using the route-specific logger if available, otherwise uses standard log
func (r *RouteConfig) Logf(format string, args ...interface{}) {
	if r.logger != nil {
		r.logger.Printf(format, args...)
	} else {
		log.Printf("[%s] "+format, append([]interface{}{r.Name}, args...)...)
	}
}

// LogWithLevel logs a message with severity level
func (r *RouteConfig) LogWithLevel(level LogLevel, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	if r.logger != nil {
		r.logger.Printf("%s: %s", level, msg)
	} else {
		log.Printf("[%s] %s: %s", r.Name, level, msg)
	}
}

// Info logs an informational message
func (r *RouteConfig) Info(format string, args ...interface{}) {
	r.LogWithLevel(LogLevelINFO, format, args...)
}

// Warn logs a warning message
func (r *RouteConfig) Warn(format string, args ...interface{}) {
	r.LogWithLevel(LogLevelWARN, format, args...)
}

// Error logs an error message
func (r *RouteConfig) Error(format string, args ...interface{}) {
	r.LogWithLevel(LogLevelERROR, format, args...)
}

type InputConfig struct {
	Path                      string `json:"path"`
	WatchMode                 string `json:"watchMode"`
	PollIntervalSeconds       int    `json:"pollIntervalSeconds"`
	HybridPollIntervalSeconds int    `json:"hybridPollIntervalSeconds"`
	PollingLogMode            string `json:"pollingLogMode"`
	SuffixFilter              string `json:"suffixFilter"`
}

type OutputConfig struct {
	Type               string `json:"type"` // "file", "queue", or "both"
	QueueDestination   string `json:"queueDestination"`
	FileDestination    string `json:"fileDestination"`
	AddTimestampSuffix bool   `json:"addTimestampSuffix"`
}

type ArchiveConfig struct {
	ProcessedPath string `json:"processedPath"`
	FailedPath    string `json:"failedPath"`
	IgnoredPath   string `json:"ignoredPath"`
}

type LogConfig struct {
	LogFolder string `json:"logFolder"`
}

type RoutesFile struct {
	Routes []RouteConfig `json:"routes"`
}

type GlobalConfig struct {
	RoutesConfigPath  string
	RabbitMQURL       string
	RabbitMQExchange  string
	LogLevel          string
	EnableFileLogging bool
}

// MessageEnvelope wraps the CSV data in a standard message format
type MessageEnvelope struct {
	Domain     string                 `json:"domain"` // e.g., "reference"
	Entity     string                 `json:"entity"` // e.g., "countries"
	Timestamp  time.Time              `json:"timestamp"`
	Source     string                 `json:"source"`     // always "csv2json"
	Version    string                 `json:"version"`    // csv2json version
	Hostname   string                 `json:"hostname"`   // host where csv2json executed
	SourceFile string                 `json:"sourceFile"` // original CSV filename
	Contract   string                 `json:"contract"`   // ingestion contract
	Payload    map[string]interface{} `json:"payload"`    // CSV row as JSON
}

func main() {
	globalConfig := loadGlobalConfig()

	// Setup service-level logging (stdout + file)
	var serviceLogFile *os.File
	if globalConfig.EnableFileLogging {
		serviceLogPath := filepath.Join(filepath.Dir(globalConfig.RoutesConfigPath), "csv2json.log")
		var err error
		serviceLogFile, err = os.OpenFile(serviceLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			log.Printf("WARN: Failed to open service log file %s: %v", serviceLogPath, err)
		} else {
			// Set default logger to write to both stdout and service log file
			log.SetOutput(io.MultiWriter(os.Stdout, serviceLogFile))
			log.Printf("INFO: Service logging enabled: %s", serviceLogPath)
			defer serviceLogFile.Close()
		}
	}

	log.Printf("INFO: csv2json v%s starting", Version)

	// Check if routes config is specified
	if globalConfig.RoutesConfigPath != "" {
		log.Printf("INFO: Running in Multi-Ingress Routing Mode")
		log.Printf("INFO: Routes config: %s", globalConfig.RoutesConfigPath)
		runMultiIngressMode(globalConfig)
	} else {
		log.Fatal("ROUTES_CONFIG environment variable must be set")
	}
}

func loadGlobalConfig() GlobalConfig {
	return GlobalConfig{
		RoutesConfigPath:  getEnv("ROUTES_CONFIG", ""),
		RabbitMQURL:       getEnv("RABBITMQ_URL", "amqp://axiom:changeme@localhost:5672/%2Faxiom"),
		RabbitMQExchange:  getEnv("RABBITMQ_EXCHANGE", "axiom.data.exchange"),
		LogLevel:          getEnv("LOG_LEVEL", "info"),
		EnableFileLogging: getEnv("ENABLE_FILE_LOGGING", "false") == "true",
	}
}

func runMultiIngressMode(globalConfig GlobalConfig) {
	// Load routes configuration
	routes, err := loadRoutes(globalConfig.RoutesConfigPath)
	if err != nil {
		log.Fatalf("Failed to load routes: %v", err)
	}

	log.Printf("INFO: Loaded %d route(s)", len(routes.Routes))

	// Create folders for all routes
	for _, route := range routes.Routes {
		createRouteFolders(route)
		log.Printf("INFO:   - Route '%s': monitoring %s -> %s.%s",
			route.Name, route.Input.Path, route.Domain, route.Entity)
	}

	// Start monitoring each route in a separate goroutine
	var wg sync.WaitGroup
	for _, route := range routes.Routes {
		wg.Add(1)
		go func(r RouteConfig) {
			defer wg.Done()
			startRouteMonitoring(r, globalConfig)
		}(route)
	}

	// Wait for all monitors
	wg.Wait()
}

func loadRoutes(configPath string) (*RoutesFile, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read routes config: %w", err)
	}

	var routes RoutesFile
	if err := json.Unmarshal(data, &routes); err != nil {
		return nil, fmt.Errorf("failed to parse routes config: %w", err)
	}

	return &routes, nil
}

func createRouteFolders(route RouteConfig) {
	folders := []string{
		route.Input.Path,
		route.Archive.ProcessedPath,
		route.Archive.FailedPath,
		route.Archive.IgnoredPath,
		route.Logging.LogFolder,
	}

	// Add output folder if file output is enabled
	if route.Output.Type == "file" || route.Output.Type == "both" {
		if route.Output.FileDestination != "" {
			folders = append(folders, route.Output.FileDestination)
		}
	}

	for _, folder := range folders {
		if err := os.MkdirAll(folder, 0755); err != nil {
			log.Printf("WARN: Failed to create folder %s: %v", folder, err)
		}
	}
}

func startRouteMonitoring(route RouteConfig, globalConfig GlobalConfig) {
	// Initialize file logging if enabled
	if globalConfig.EnableFileLogging && route.Logging.LogFolder != "" {
		logFilePath := filepath.Join(route.Logging.LogFolder, fmt.Sprintf("%s.log", route.Name))
		logFile, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			log.Printf("[%s] WARN: Failed to open log file %s: %v", route.Name, logFilePath, err)
		} else {
			route.logFile = logFile
			route.logger = log.New(io.MultiWriter(os.Stdout, logFile), fmt.Sprintf("[%s] ", route.Name), log.LstdFlags)
			route.logger.Printf("INFO: File logging enabled: %s", logFilePath)
			defer logFile.Close()
		}
	}

	route.Info("Starting %s mode monitoring", route.Input.WatchMode)

	switch route.Input.WatchMode {
	case "event":
		startEventWatchForRoute(route, globalConfig)
	case "poll":
		startPollWatchForRoute(route, globalConfig)
	case "hybrid":
		startHybridWatchForRoute(route, globalConfig)
	default:
		route.Warn("Invalid watch mode '%s', defaulting to hybrid", route.Input.WatchMode)
		startHybridWatchForRoute(route, globalConfig)
	}
}

func startEventWatchForRoute(route RouteConfig, globalConfig GlobalConfig) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		route.Error("Failed to create fsnotify watcher: %v", err)
		return
	}
	defer watcher.Close()

	err = watcher.Add(route.Input.Path)
	if err != nil {
		route.Error("Failed to watch folder %s: %v", route.Input.Path, err)
		return
	}

	route.Info("Event watching enabled on %s", route.Input.Path)

	// Process existing files immediately
	scanFolderForRoute(route, globalConfig)

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Create == fsnotify.Create {
				handleFileForRoute(event.Name, route, globalConfig)
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			route.Error("Watcher error: %v", err)
		}
	}
}

func startPollWatchForRoute(route RouteConfig, globalConfig GlobalConfig) {
	interval := route.Input.PollIntervalSeconds
	if interval == 0 {
		interval = 5
	}

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	route.Info("Poll watching enabled (interval: %ds)", interval)

	// Process existing files first
	scanFolderForRoute(route, globalConfig)

	for range ticker.C {
		logPollCycle(route, "poll")
		scanFolderForRoute(route, globalConfig)
	}
}

func startHybridWatchForRoute(route RouteConfig, globalConfig GlobalConfig) {
	// Process existing files immediately before starting watchers
	scanFolderForRoute(route, globalConfig)

	// Start event watcher in goroutine
	go startEventWatchForRoute(route, globalConfig)

	// Start backup polling
	interval := route.Input.HybridPollIntervalSeconds
	if interval == 0 {
		interval = 60
	}

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	route.Info("Hybrid watching enabled (event + %ds backup polling)", interval)

	for range ticker.C {
		logPollCycle(route, "hybrid")
		scanFolderForRoute(route, globalConfig)
	}
}

func logPollCycle(route RouteConfig, mode string) {
	// Normalize pollingLogMode (default: "always")
	logMode := route.Input.PollingLogMode
	if logMode == "" {
		logMode = "always"
	}

	if logMode == "always" {
		if mode == "hybrid" {
			route.Info("Backup poll cycle started")
		} else {
			route.Info("Poll cycle started")
		}
	}
	// "on-files" mode logs in scanFolderForRoute only when files found
	// "never" mode doesn't log poll cycles at all
}

func scanFolderForRoute(route RouteConfig, globalConfig GlobalConfig) {
	entries, err := os.ReadDir(route.Input.Path)
	if err != nil {
		route.Error("Error reading input folder: %v", err)
		return
	}

	// Normalize pollingLogMode (default: "always")
	logMode := route.Input.PollingLogMode
	if logMode == "" {
		logMode = "always"
	}

	// Count eligible files
	fileCount := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			fileCount++
		}
	}

	// Log if mode is "on-files" and files were found
	if logMode == "on-files" && fileCount > 0 {
		route.Info("Poll cycle found %d file(s)", fileCount)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filePath := filepath.Join(route.Input.Path, entry.Name())
		handleFileForRoute(filePath, route, globalConfig)
	}
}

func handleFileForRoute(filePath string, route RouteConfig, globalConfig GlobalConfig) {
	filename := filepath.Base(filePath)

	// Check suffix filter
	if !matchesSuffixFilter(filename, route.Input.SuffixFilter) {
		route.Info("Ignoring %s (doesn't match suffix filter)", filename)
		archiveFile(filePath, route.Archive.IgnoredPath, filename)
		return
	}

	route.Info("Processing file: %s", filename)

	if err := processFileForRoute(filePath, route, globalConfig); err != nil {
		route.Error("Failed to process %s: %v", filename, err)
		archiveFile(filePath, route.Archive.FailedPath, filename)
	} else {
		route.Info("✓ Successfully processed %s", filename)
		archiveFile(filePath, route.Archive.ProcessedPath, filename)
	}
}

func matchesSuffixFilter(filename, filter string) bool {
	if filter == "" || filter == "*" {
		return true
	}

	suffixes := strings.Split(filter, ",")
	for _, suffix := range suffixes {
		suffix = strings.TrimSpace(suffix)
		if strings.HasSuffix(strings.ToLower(filename), strings.ToLower(suffix)) {
			return true
		}
	}
	return false
}

func archiveFile(srcPath, archiveFolder, filename string) {
	timestamp := time.Now().Format("20060102_150405")
	ext := filepath.Ext(filename)
	nameWithoutExt := strings.TrimSuffix(filename, ext)
	archivedFilename := fmt.Sprintf("%s_%s%s", nameWithoutExt, timestamp, ext)
	dstPath := filepath.Join(archiveFolder, archivedFilename)

	if err := os.Rename(srcPath, dstPath); err != nil {
		log.Printf("ERROR: Failed to archive %s: %v", filename, err)
	}
}

func generateOutputFilename(inputPath string, addTimestamp bool) string {
	base := filepath.Base(inputPath)
	ext := filepath.Ext(base)
	nameWithoutExt := strings.TrimSuffix(base, ext)

	if addTimestamp {
		timestamp := time.Now().Format("20060102_150405")
		return fmt.Sprintf("%s_%s.json", nameWithoutExt, timestamp)
	}
	return fmt.Sprintf("%s.json", nameWithoutExt)
}

func processFileForRoute(filePath string, route RouteConfig, globalConfig GlobalConfig) error {
	// Open CSV file
	file, err := os.Open(filePath)
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

	// Strip UTF-8 BOM from first header if present
	if len(headers) > 0 && len(headers[0]) > 0 {
		headers[0] = strings.TrimPrefix(headers[0], "\uFEFF")       // UTF-8 BOM
		headers[0] = strings.TrimPrefix(headers[0], "\xEF\xBB\xBF") // UTF-8 BOM bytes
	}

	// Setup RabbitMQ connection if queue output is needed
	var conn *amqp.Connection
	var channel *amqp.Channel

	needsQueue := route.Output.Type == "queue" || route.Output.Type == "both"
	if needsQueue {
		conn, err = amqp.Dial(globalConfig.RabbitMQURL)
		if err != nil {
			return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
		}
		defer conn.Close()

		channel, err = conn.Channel()
		if err != nil {
			return fmt.Errorf("failed to open channel: %w", err)
		}
		defer channel.Close()

		// Declare exchange (idempotent)
		err = channel.ExchangeDeclare(
			globalConfig.RabbitMQExchange, // name
			"topic",                       // type
			true,                          // durable
			false,                         // auto-deleted
			false,                         // internal
			false,                         // no-wait
			nil,                           // arguments
		)
		if err != nil {
			return fmt.Errorf("failed to declare exchange: %w", err)
		}
	}

	// Setup file output if needed
	var outputFile *os.File
	needsFile := route.Output.Type == "file" || route.Output.Type == "both"
	if needsFile {
		outputFilename := generateOutputFilename(filePath, route.Output.AddTimestampSuffix)
		outputPath := filepath.Join(route.Output.FileDestination, outputFilename)

		outputFile, err = os.Create(outputPath)
		if err != nil {
			return fmt.Errorf("failed to create output file: %w", err)
		}
		defer outputFile.Close()

		// Start JSON array
		if _, err := outputFile.WriteString("[\n"); err != nil {
			return fmt.Errorf("failed to write to output file: %w", err)
		}
	}

	// Generate routing key: domain.entity (e.g., "reference.countries")
	var routingKey string
	if needsQueue {
		routingKey = fmt.Sprintf("%s.%s", route.Domain, route.Entity)
	}

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
		rowData := make(map[string]interface{})
		for i, value := range row {
			if i < len(headers) {
				rowData[headers[i]] = value
			}
		}

		// Get hostname
		hostname, _ := os.Hostname()
		if hostname == "" {
			hostname = "unknown"
		}

		// Wrap in message envelope with ingestion contract
		envelope := MessageEnvelope{
			Domain:     route.Domain,
			Entity:     route.Entity,
			Timestamp:  time.Now().UTC(),
			Source:     "csv2json",
			Version:    Version,
			Hostname:   hostname,
			SourceFile: filepath.Base(filePath),
			Contract:   route.IngestionContract,
			Payload:    rowData,
		}

		// Marshal to JSON
		body, err := json.Marshal(envelope)
		if err != nil {
			return fmt.Errorf("failed to marshal message: %w", err)
		}

		// Publish to RabbitMQ if needed
		if needsQueue {
			err = channel.Publish(
				globalConfig.RabbitMQExchange,
				routingKey,
				false,
				false,
				amqp.Publishing{
					ContentType: "application/json",
					Body:        body,
					Timestamp:   time.Now(),
				},
			)
			if err != nil {
				return fmt.Errorf("failed to publish message: %w", err)
			}
		}

		// Write to file if needed
		if needsFile {
			// Add comma before all but first record
			if rowCount > 0 {
				if _, err := outputFile.WriteString(",\n"); err != nil {
					return fmt.Errorf("failed to write to output file: %w", err)
				}
			}

			// Pretty-print JSON for readability
			var prettyJSON bytes.Buffer
			if err := json.Indent(&prettyJSON, body, "  ", "  "); err != nil {
				return fmt.Errorf("failed to format JSON: %w", err)
			}

			if _, err := outputFile.Write(prettyJSON.Bytes()); err != nil {
				return fmt.Errorf("failed to write to output file: %w", err)
			}
		}

		rowCount++
		if rowCount%100 == 0 {
			route.Info("Processed %d rows...", rowCount)
		}
	}

	// Close JSON array in file output
	if needsFile {
		if _, err := outputFile.WriteString("\n]\n"); err != nil {
			return fmt.Errorf("failed to close output file: %w", err)
		}
	}

	outputTypes := route.Output.Type
	route.Info("✓ Processed %d rows from %s (output: %s)", rowCount, filepath.Base(filePath), outputTypes)
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var intVal int
		if _, err := fmt.Sscanf(value, "%d", &intVal); err == nil {
			return intVal
		}
	}
	return defaultValue
}
