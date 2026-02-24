package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/techie2000/axiom/internal/config"
	"github.com/techie2000/axiom/internal/handler"
	"github.com/techie2000/axiom/internal/middleware"
	"github.com/techie2000/axiom/internal/repository"
	"github.com/techie2000/axiom/internal/service"
	"github.com/techie2000/axiom/internal/version"
	"github.com/techie2000/axiom/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "github.com/techie2000/axiom/docs" // Swagger docs
)

// @title Axiom API
// @version 1.0
// @description Financial Services Static Data Management System
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.email support@axiom.example.com
// TODO: Replace placeholder contact email before production launch.

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	logger.Init(cfg.Log.Level)

	// Connect to database
	db, err := connectDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize repositories
	repos := repository.NewRepositories(db)

	// LEI data directory from config
	leiDataDir := cfg.LEI.DataDir
	if err := os.MkdirAll(leiDataDir, 0755); err != nil {
		log.Fatalf("Failed to create LEI data directory: %v", err)
	}

	// Master data directory (backend/data/masterdata)
	masterDataDir := filepath.Join("backend", "data", "masterdata")
	// Check if running from backend directory already
	if _, err := os.Stat("data/masterdata"); err == nil {
		masterDataDir = "data/masterdata"
	}

	// Initialize services with both data directories
	services := service.NewServices(repos, db, leiDataDir, masterDataDir)

	// Load master data on startup (idempotent - only loads if tables are empty)
	logger.Info().Msg("Checking master data...")
	if err := services.MasterData.LoadAllMasterData(); err != nil {
		logger.Warn().Err(err).Msg("Failed to load master data, continuing anyway...")
	}

	// Initialize scheduler service for LEI data acquisition and master data sync (with config for schedules)
	schedulerService := service.NewSchedulerService(services.LEI, services.LEILevel2, services.MasterData, cfg)

	// Start scheduler
	if err := schedulerService.Start(); err != nil {
		log.Fatalf("Failed to start scheduler: %v", err)
	}
	defer schedulerService.Stop()

	// Initialize handlers
	handlers := handler.NewHandlers(services, schedulerService)

	// Setup Gin router
	router := setupRouter(cfg, handlers)

	// Start server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		logger.Info().Msgf("Starting Axiom API server on port %d", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Info().Msg("Server exited")
}

func connectDatabase(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		cfg.Database.SSLMode,
	)

	// Configure GORM logger based on DATABASE_LOGLEVEL
	logLevel := parseGORMLogLevel(cfg.Database.LogLevel)
	customLogger := newCustomGORMLogger(logLevel)
	gormConfig := &gorm.Config{
		Logger: customLogger,
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	logger.Info().Msgf("Database connection established (log level: %s)", cfg.Database.LogLevel)
	return db, nil
}

func parseGORMLogLevel(level string) gormLogger.LogLevel {
	switch strings.ToLower(level) {
	case "silent":
		return gormLogger.Silent
	case "error":
		return gormLogger.Error
	case "warn", "warning":
		return gormLogger.Warn
	case "info":
		return gormLogger.Info
	default:
		return gormLogger.Warn // Default to warn for production
	}
}

// customGORMLogger wraps the default GORM logger to suppress "record not found" errors
type customGORMLogger struct {
	gormLogger.Interface
	logLevel gormLogger.LogLevel
}

func newCustomGORMLogger(level gormLogger.LogLevel) *customGORMLogger {
	return &customGORMLogger{
		Interface: gormLogger.Default.LogMode(level),
		logLevel:  level,
	}
}

// Error overrides the Error method to suppress "record not found" logs
func (l *customGORMLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	// Suppress "record not found" errors as they're expected during upsert operations
	if l.logLevel >= gormLogger.Error {
		if !strings.Contains(msg, "record not found") {
			l.Interface.Error(ctx, msg, data...)
		}
	}
}

// Trace overrides the Trace method to suppress "record not found" query logs
func (l *customGORMLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	// Suppress trace logs for "record not found" errors
	if err != nil && err.Error() == "record not found" {
		return
	}
	l.Interface.Trace(ctx, begin, fc, err)
}

func setupRouter(cfg *config.Config, h *handler.Handlers) *gin.Engine {
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS(cfg))
	router.Use(middleware.RateLimit())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Version endpoint
	router.GET("/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"version":     version.Version,
			"gitCommit":   version.GitCommit,
			"buildDate":   version.BuildDate,
			"fullVersion": version.GetFullVersion(),
		})
	})

	// Debug CORS config (remove in production)
	router.GET("/debug/cors", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"allowed_origins": cfg.CORS.AllowedOrigins,
			"allowed_methods": cfg.CORS.AllowedMethods,
			"allowed_headers": cfg.CORS.AllowedHeaders,
		})
	})

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Public routes
		auth := v1.Group("/auth")
		{
			auth.POST("/login", h.Auth.Login)
			auth.POST("/register", h.Auth.Register)
		}

		// Public monitoring routes (no auth required)
		v1.GET("/lei/status/:jobType", h.LEI.GetProcessingStatus)

		// Public reference data routes (read-only, no auth required)
		v1.GET("/countries", h.Country.List)
		v1.GET("/countries/:id", h.Country.Get)
		v1.GET("/currencies", h.Currency.List)
		v1.GET("/currencies/:id", h.Currency.Get)
		v1.GET("/languages", h.Language.List)

		// Public LEI data routes (read-only, no auth required)
		v1.GET("/lei", h.LEI.ListLEI)
		v1.GET("/lei-countries", h.LEI.GetDistinctCountries)
		v1.GET("/lei-regions", h.LEI.GetDistinctRegions)
		v1.GET("/lei-legal-forms", h.LEI.GetDistinctLegalForms)
		v1.GET("/lei/record/:id", h.LEI.GetLEIByID)
		v1.GET("/lei/:lei/audit", h.LEI.GetAuditHistory)
		v1.GET("/lei/:lei", h.LEI.GetLEIByCode)

		// Protected routes (require JWT)
		protected := v1.Group("")
		protected.Use(middleware.JWTAuth(cfg))
		{
			// Protected write operations for countries and currencies
			protected.POST("/countries", h.Country.Create)
			protected.PUT("/countries/:id", h.Country.Update)
			protected.DELETE("/countries/:id", h.Country.Delete)
			protected.POST("/currencies", h.Currency.Create)
			protected.PUT("/currencies/:id", h.Currency.Update)
			protected.DELETE("/currencies/:id", h.Currency.Delete)

			// Code mapping routes (full CRUD + translate)
			codeMappings := protected.Group("/code-mappings")
			{
				codeMappings.GET("", h.CodeMapping.List)
				codeMappings.GET("/translate", h.CodeMapping.Translate)
				codeMappings.GET("/:id", h.CodeMapping.Get)
				codeMappings.POST("", h.CodeMapping.Create)
				codeMappings.PUT("/:id", h.CodeMapping.Update)
				codeMappings.DELETE("/:id", h.CodeMapping.Delete)
			}

			// Domain data routes

			entities := protected.Group("/entities")
			{
				entities.GET("", h.Entity.List)
				entities.GET("/:id", h.Entity.Get)
				entities.POST("", h.Entity.Create)
				entities.PUT("/:id", h.Entity.Update)
				entities.DELETE("/:id", h.Entity.Delete)
			}

			instruments := protected.Group("/instruments")
			{
				instruments.GET("", h.Instrument.List)
				instruments.GET("/:id", h.Instrument.Get)
				instruments.POST("", h.Instrument.Create)
				instruments.PUT("/:id", h.Instrument.Update)
				instruments.DELETE("/:id", h.Instrument.Delete)
			}

			accounts := protected.Group("/accounts")
			{
				accounts.GET("", h.Account.List)
				accounts.GET("/:id", h.Account.Get)
				accounts.POST("", h.Account.Create)
				accounts.PUT("/:id", h.Account.Update)
				accounts.DELETE("/:id", h.Account.Delete)
			}

			ssis := protected.Group("/ssis")
			{
				ssis.GET("", h.SSI.List)
				ssis.GET("/:id", h.SSI.Get)
				ssis.POST("", h.SSI.Create)
				ssis.PUT("/:id", h.SSI.Update)
				ssis.DELETE("/:id", h.SSI.Delete)
			}

			// LEI management routes (write operations only)
			lei := protected.Group("/lei")
			{
				lei.POST("/sync/full", h.LEI.TriggerFullSync)
				lei.POST("/sync/delta", h.LEI.TriggerDeltaSync)
				lei.POST("/sync/level2", h.LEI.TriggerLevel2Sync)
				lei.POST("/source-file/:id/resume", h.LEI.ResumeProcessing)
			}

			// Data acquisition routes
			dataAcq := protected.Group("/data")
			{
				dataAcq.POST("/import", h.DataAcquisition.Import)
				dataAcq.POST("/export", h.DataAcquisition.Export)
				dataAcq.GET("/jobs", h.DataAcquisition.ListJobs)
				dataAcq.GET("/jobs/:id", h.DataAcquisition.GetJob)
			}
		}
	}

	return router
}
