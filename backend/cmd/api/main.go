package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	docs "github.com/techie2000/axiom/docs"
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
	"github.com/swaggo/swag"
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

	// Keep static defaults at startup and derive request-specific host/scheme in the
	// Swagger route handler to support reverse proxies and non-localhost deployments.
	docs.SwaggerInfo.Host = "localhost:8080"
	docs.SwaggerInfo.Schemes = []string{"http"}

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
	services := service.NewServices(repos, db, leiDataDir, masterDataDir, cfg.JWT.Secret, cfg.JWT.Expiry)

	// Load master data on startup (idempotent - only loads if tables are empty)
	logger.Info().Msg("Checking master data...")
	if err := services.MasterData.LoadAllMasterData(); err != nil {
		logger.Warn().Err(err).Msg("Failed to load master data, continuing anyway...")
	}

	// Seed the Playwright end-to-end test user when running in dev/main environments.
	// Controlled by PLAYWRIGHT_SEED_USER=true in the environment file.
	// Never enable this in UAT or production.
	if cfg.Testing.PlaywrightSeedUser {
		logger.Info().Msg("PLAYWRIGHT_SEED_USER is enabled: ensuring Playwright test user exists...")
		if err := services.Auth.EnsurePlaywrightTestUser(
			cfg.Testing.PlaywrightUserEmail,
			cfg.Testing.PlaywrightUserPassword,
		); err != nil {
			logger.Warn().Err(err).Msg("Failed to seed Playwright test user, continuing anyway...")
		}
	}

	// Initialize scheduler service for LEI data acquisition and master data sync (with config for schedules)
	// Uses the GLEIF-aware constructor so reference code lists are synced before each LEI ingest.
	schedulerService := service.NewSchedulerServiceWithGLEIF(
		services.LEI,
		services.LEILevel2,
		services.MasterData,
		services.GLEIFReference,
		cfg,
	)

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

	// Verify database connectivity before proceeding with warm-up
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to verify database connectivity: %w", err)
	}

	// Pre-warm connection pool to avoid high latency on first user request
	// Use a new context for warm-up since we've already used the ping context
	warmCtx, warmCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer warmCancel()

	successCount := 0
	var wg sync.WaitGroup
	var mu sync.Mutex

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var dummy int
			if err := db.WithContext(warmCtx).Raw("SELECT 1").Scan(&dummy).Error; err != nil {
				logger.Warn().Err(err).Msg("Connection pool warm-up query failed")
			} else {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if successCount == 0 {
		return nil, fmt.Errorf("connection pool warm-up failed: no queries succeeded")
	}

	logger.Info().Msgf("Connection pool warmed up successfully (%d/%d queries succeeded)", successCount, 5)
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
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "Axiom API",
			"status":  "running",
			"routes": gin.H{
				"health":  "/health",
				"version": "/version",
				"swagger": "/swagger/index.html",
				"apiBase": "/api/v1",
			},
		})
	})

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

	// Swagger documentation
	swaggerHandler := ginSwagger.WrapHandler(swaggerFiles.Handler, ginSwagger.URL("/swagger/doc.json"))
	router.GET("/swagger/doc.json", func(c *gin.Context) {
		swaggerDoc, err := buildSwaggerDoc(resolveSwaggerHost(c), resolveSwaggerScheme(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to render swagger document"})
			return
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", swaggerDoc)
	})
	router.GET("/swagger/*any", swaggerHandler)

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

		// Public approved translations (read-only, no auth required)
		v1.GET("/translations", h.UITranslation.ListTranslations)

		// Public LEI data routes (read-only, no auth required)
		v1.GET("/lei", h.LEI.ListLEI)
		v1.GET("/lei/count", h.LEI.GetLEICount)
		v1.GET("/lei/import-failures", h.LEI.GetImportProcessingFailures)
		v1.GET("/lei/level2/failures", h.LEI.GetLevel2ProcessingFailures)
		v1.GET("/lei/names", h.LEI.GetLegalNamesByLEICodes)
		v1.GET("/lei-countries", h.LEI.GetDistinctCountries)
		v1.GET("/lei-categories", h.LEI.GetDistinctCategories)
		v1.GET("/lei-regions", h.LEI.GetDistinctRegions)
		v1.GET("/lei-legal-forms", h.LEI.GetDistinctLegalForms)
		v1.GET("/lei/record/:id", h.LEI.GetLEIByID)
		v1.GET("/lei/:lei/predecessors", h.LEI.GetPredecessorLEIs)
		v1.GET("/lei/:lei/audit", h.LEI.GetAuditHistory)
		v1.GET("/lei/:lei", h.LEI.GetLEIByCode)

		// Protected routes (require JWT)
		protected := v1.Group("")
		protected.Use(middleware.JWTAuth(cfg))
		{
			// Admin-only user management routes
			adminAuth := protected.Group("/auth")
			adminAuth.Use(middleware.AdminRequired())
			{
				adminAuth.GET("/users", h.Auth.ListUsers)
				adminAuth.POST("/users/:id/approve", h.Auth.ApproveUser)
				adminAuth.POST("/users/:id/reject", h.Auth.RejectUser)
				adminAuth.PUT("/users/:id/role", h.Auth.UpdateUserRole)
			}

			// User preference routes (any authenticated user)
			prefs := protected.Group("/preferences")
			{
				prefs.GET("", h.UserPreference.GetPreferences)
				prefs.PUT("", h.UserPreference.SetPreference)
				prefs.DELETE("", h.UserPreference.DeletePreference)
			}

			// Translation routes: public listing, authenticated submission, admin review/delete
			translations := protected.Group("/translations")
			{
				translations.POST("", h.UITranslation.SubmitTranslation)
			}
			adminTranslations := protected.Group("/translations")
			adminTranslations.Use(middleware.AdminRequired())
			{
				adminTranslations.POST("/:id/approve", h.UITranslation.ApproveTranslation)
				adminTranslations.POST("/:id/reject", h.UITranslation.RejectTranslation)
				adminTranslations.DELETE("/:id", h.UITranslation.DeleteTranslation)
			}
			adminTranslationList := protected.Group("/admin/translations")
			adminTranslationList.Use(middleware.AdminRequired())
			{
				adminTranslationList.GET("", h.UITranslation.ListAdminTranslations)
			}

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
				lei.POST("/sync/masterdata", h.LEI.TriggerMasterDataSync)
				lei.POST("/sync/gleif-reference", h.LEI.TriggerGLEIFReferenceSync)
				lei.POST("/sync/full", h.LEI.TriggerFullSync)
				lei.POST("/sync/delta", h.LEI.TriggerDeltaSync)
				lei.POST("/sync/level2", h.LEI.TriggerLevel2Sync)
				lei.POST("/sync/level2/rr", h.LEI.TriggerLevel2RRSync)
				lei.POST("/sync/level2/repex", h.LEI.TriggerLevel2REPEXSync)
				lei.POST("/source-file/:id/resume", h.LEI.ResumeProcessing)
			}

			// Provisional LEI management routes (admin-only)
			provisionalLEI := protected.Group("/lei/provisional")
			provisionalLEI.Use(middleware.AdminRequired())
			{
				provisionalLEI.GET("", h.ProvisionalLEI.List)
				provisionalLEI.GET("/:lei", h.ProvisionalLEI.Get)
				provisionalLEI.POST("", h.ProvisionalLEI.Create)
				provisionalLEI.PUT("/:lei", h.ProvisionalLEI.Update)
				provisionalLEI.POST("/:lei/succeed", h.ProvisionalLEI.Succeed)
			}

			// User–entity identity link routes (admin-only)
			userEntityLinks := protected.Group("/user-entity-links")
			userEntityLinks.Use(middleware.AdminRequired())
			{
				userEntityLinks.GET("", h.UserEntityLink.ListActive)
				userEntityLinks.GET("/user/:user_id", h.UserEntityLink.ListByUser)
				userEntityLinks.GET("/lei/:lei", h.UserEntityLink.ListByLEI)
				userEntityLinks.GET("/:id", h.UserEntityLink.Get)
				userEntityLinks.POST("", h.UserEntityLink.Grant)
				userEntityLinks.PUT("/:id", h.UserEntityLink.Update)
				userEntityLinks.POST("/:id/revoke", h.UserEntityLink.Revoke)
				userEntityLinks.POST("/:id/unrevoke", h.UserEntityLink.Unrevoke)
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

func resolveSwaggerHost(c *gin.Context) string {
	if forwardedHost, ok := normalizeForwardedHost(c.GetHeader("X-Forwarded-Host")); ok {
		return forwardedHost
	}
	if host, ok := normalizeSwaggerHost(c.Request.Host); ok {
		return host
	}
	return "localhost:8080"
}

func resolveSwaggerScheme(c *gin.Context) string {
	if forwardedProto := normalizeForwardedProto(c.GetHeader("X-Forwarded-Proto")); forwardedProto != "" {
		if forwardedProto == "https" {
			return "https"
		}
		return "http"
	}
	if c.Request.TLS != nil {
		return "https"
	}
	return "http"
}

func buildSwaggerDoc(host, scheme string) ([]byte, error) {
	doc, err := swag.ReadDoc(docs.SwaggerInfo.InstanceName())
	if err != nil {
		return nil, fmt.Errorf("read swagger document: %w", err)
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(doc), &payload); err != nil {
		return nil, fmt.Errorf("decode swagger document: %w", err)
	}

	payload["host"] = host
	payload["schemes"] = []string{scheme}

	rendered, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode swagger document: %w", err)
	}

	return rendered, nil
}

func normalizeForwardedHost(raw string) (string, bool) {
	parts := strings.Split(raw, ",")
	if len(parts) == 0 {
		return "", false
	}

	return normalizeSwaggerHost(parts[0])
}

func normalizeSwaggerHost(raw string) (string, bool) {
	host := strings.TrimSpace(raw)
	if host == "" || strings.Contains(host, "://") {
		return "", false
	}

	parsed, err := url.Parse("//" + host)
	if err != nil || parsed.Host != host || parsed.Path != "" || parsed.User != nil {
		return "", false
	}

	hostname := parsed.Hostname()
	if hostname == "" || strings.ContainsAny(hostname, " \t\r\n\\/") {
		return "", false
	}

	if ip := net.ParseIP(hostname); ip == nil && strings.ContainsAny(hostname, "[]:") {
		return "", false
	}

	if port := parsed.Port(); port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return "", false
		}
	}

	return host, true
}

func normalizeForwardedProto(raw string) string {
	parts := strings.Split(raw, ",")
	if len(parts) == 0 {
		return ""
	}

	proto := strings.ToLower(strings.TrimSpace(parts[0]))
	if proto == "https" {
		return "https"
	}
	if proto == "http" {
		return "http"
	}
	return ""
}
