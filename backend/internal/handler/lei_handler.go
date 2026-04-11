package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/service"
)

// LEIHandler handles LEI-related HTTP requests
type LEIHandler struct {
	leiService       service.LEIService
	level2Service    service.LEILevel2Service
	schedulerService service.SchedulerService
}

// NewLEIHandler creates a new LEI handler
func NewLEIHandler(leiService service.LEIService, schedulerService service.SchedulerService) *LEIHandler {
	return &LEIHandler{
		leiService:       leiService,
		level2Service:    nil,
		schedulerService: schedulerService,
	}
}

// NewLEIHandlerWithLevel2 creates a new LEI handler with Level 2 service capabilities.
func NewLEIHandlerWithLevel2(
	leiService service.LEIService,
	level2Service service.LEILevel2Service,
	schedulerService service.SchedulerService,
) *LEIHandler {
	return &LEIHandler{
		leiService:       leiService,
		level2Service:    level2Service,
		schedulerService: schedulerService,
	}
}

// GetDistinctCountries returns a list of all unique countries in the LEI database
// @Summary Get distinct countries
// @Description Get sorted list of unique countries from LEI records
// @Tags LEI
// @Produce json
// @Success 200 {array} string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei-countries [get]
func (h *LEIHandler) GetDistinctCountries(c *gin.Context) {
	countries, err := h.leiService.GetDistinctCountries()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve countries"})
		return
	}
	c.JSON(http.StatusOK, countries)
}

// GetDistinctCategories returns a list of all unique category values in the LEI database
// @Summary Get distinct categories
// @Description Get sorted list of unique category values from LEI records
// @Tags LEI
// @Produce json
// @Success 200 {array} string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei-categories [get]
func (h *LEIHandler) GetDistinctCategories(c *gin.Context) {
	categories, err := h.leiService.GetDistinctCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve categories"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

// GetDistinctRegions returns a list of all unique region values in the LEI database
// @Summary Get distinct regions
// @Description Get sorted list of unique regions from LEI records
// @Tags LEI
// @Produce json
// @Success 200 {array} string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei-regions [get]
func (h *LEIHandler) GetDistinctRegions(c *gin.Context) {
	regions, err := h.leiService.GetDistinctRegions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve regions"})
		return
	}
	c.JSON(http.StatusOK, regions)
}

// GetDistinctLegalForms returns a list of all unique legal forms in the LEI database
// @Summary Get distinct legal forms
// @Description Get sorted list of unique legal form values from LEI records
// @Tags LEI
// @Produce json
// @Success 200 {array} string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei-legal-forms [get]
func (h *LEIHandler) GetDistinctLegalForms(c *gin.Context) {
	legalForms, err := h.leiService.GetDistinctLegalForms()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve legal forms"})
		return
	}
	c.JSON(http.StatusOK, legalForms)
}

// GetLEICount returns the total number of LEI records in the database
// @Summary Get total LEI record count
// @Description Returns the total count of LEI records stored in the database, regardless of sync status
// @Tags LEI
// @Produce json
// @Success 200 {object} map[string]int64
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/count [get]
func (h *LEIHandler) GetLEICount(c *gin.Context) {
	count, err := h.leiService.CountLEIRecords()
	if err != nil {
		log.Error().Err(err).Msg("Failed to count LEI records")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count LEI records"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GetLEIByCode retrieves an LEI record by LEI code
// @Summary Get LEI record by code
// @Description Get a specific LEI record by its LEI code
// @Tags LEI
// @Accept json
// @Produce json
// @Param lei path string true "LEI code"
// @Success 200 {object} domain.LEIRecord
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/{lei} [get]
func (h *LEIHandler) GetLEIByCode(c *gin.Context) {
	lei := c.Param("lei")

	record, err := h.leiService.GetLEIByCode(lei)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "LEI record not found"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// GetPredecessorLEIs retrieves LEI records that point to this LEI as successor
// @Summary Get predecessor LEI records
// @Description Get LEI records whose successor_lei equals the provided LEI
// @Tags LEI
// @Accept json
// @Produce json
// @Param lei path string true "LEI code"
// @Success 200 {array} domain.LEIRecord
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/{lei}/predecessors [get]
func (h *LEIHandler) GetPredecessorLEIs(c *gin.Context) {
	lei := c.Param("lei")

	records, err := h.leiService.GetPredecessorLEIs(lei)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve predecessor LEI records"})
		return
	}

	c.JSON(http.StatusOK, records)
}

// GetLEIByID retrieves an LEI record by ID
// @Summary Get LEI record by ID
// @Description Get a specific LEI record by its database ID
// @Tags LEI
// @Accept json
// @Produce json
// @Param id path string true "Record ID"
// @Success 200 {object} domain.LEIRecord
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/record/{id} [get]
func (h *LEIHandler) GetLEIByID(c *gin.Context) {
	id := c.Param("id")

	record, err := h.leiService.GetLEIByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "LEI record not found"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// ListLEI retrieves all LEI records with pagination, search, and filters
// @Summary List LEI records
// @Description Get a paginated list of LEI records with optional search and filters
// @Tags LEI
// @Accept json
// @Produce json
// @Param limit query int false "Limit" default(50)
// @Param offset query int false "Offset" default(0)
// @Param search query string false "Search term (LEI code or legal name)"
// @Param status query string false "Entity status filter (e.g., ACTIVE, INACTIVE)"
// @Param category query string false "Entity category filter (e.g., GENERAL, FUND)"
// @Param country query string false "Country code filter (e.g., US, GB)"
// @Param sortBy query string false "Sort field (lei, legal_name, entity_status, entity_category, legal_address_country, last_update_date)"
// @Param sortOrder query string false "Sort order (asc, desc)" default(asc)
// @Param includeLinkedNames query boolean false "Include successor/managing LOU legal names in list response"
// @Success 200 {array} domain.LEIRecord
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei [get]
func (h *LEIHandler) ListLEI(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	status := c.Query("status")
	category := c.Query("category")
	country := c.Query("country")
	includeLinkedNames := strings.EqualFold(c.DefaultQuery("includeLinkedNames", "false"), "true")
	sortBy := c.Query("sortBy")       // Empty if not provided - repository will use Hybrid Approach
	sortOrder := c.Query("sortOrder") // Empty if not provided - repository will choose based on context

	// Get visible columns from frontend for dynamic SELECT optimization
	// Default to core columns including other_names for name search display
	columns := c.DefaultQuery("columns", "id,lei,legal_name,other_names,entity_status,entity_category,legal_address_country,last_update_date")

	// Allow up to 501 records (frontend requests itemsPerPage + 1 to detect more pages)
	if limit > 501 {
		limit = 501
	}

	records, err := h.leiService.GetAllLEIWithFilters(limit, offset, search, status, category, country, sortBy, sortOrder, columns, includeLinkedNames)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LEI records"})
		return
	}

	c.JSON(http.StatusOK, records)
}

// GetLegalNamesByLEICodes retrieves legal names for a batch of LEI codes in a single round-trip.
// @Summary Batch-fetch legal names for a set of LEI codes
// @Description Returns a map of LEI code to legal name. Input codes are trimmed, normalized, deduplicated, and validated (20-char uppercase alphanumeric). Codes not found are absent from the response.
// @Tags LEI
// @Produce json
// @Param codes query string true "Comma-separated list of LEI codes (max 500)"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/names [get]
func (h *LEIHandler) GetLegalNamesByLEICodes(c *gin.Context) {
	rawCodes := c.Query("codes")
	if rawCodes == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "codes query parameter is required"})
		return
	}

	codes := strings.Split(rawCodes, ",")
	const maxCodes = 500
	if len(codes) > maxCodes {
		codes = codes[:maxCodes]
	}

	filtered := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		normalized := strings.ToUpper(strings.TrimSpace(code))
		if !isValidLEICode(normalized) {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		filtered = append(filtered, normalized)
	}
	codes = filtered

	if len(codes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one valid LEI code is required"})
		return
	}

	names, err := h.leiService.GetLegalNamesByLEICodes(codes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LEI names"})
		return
	}

	c.JSON(http.StatusOK, names)
}

func isValidLEICode(code string) bool {
	if len(code) != 20 {
		return false
	}
	for i := range len(code) {
		ch := code[i]
		isUpperLetter := ch >= 'A' && ch <= 'Z'
		isDigit := ch >= '0' && ch <= '9'
		if !isUpperLetter && !isDigit {
			return false
		}
	}
	return true
}

// GetAuditHistory retrieves audit history for an LEI
// @Summary Get LEI audit history
// @Description Get audit trail for a specific LEI record
// @Tags LEI
// @Accept json
// @Produce json
// @Param lei path string true "LEI code"
// @Param limit query int false "Limit" default(20)
// @Success 200 {array} domain.LEIRecordAudit
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/{lei}/audit [get]
func (h *LEIHandler) GetAuditHistory(c *gin.Context) {
	lei := c.Param("lei")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	audits, err := h.leiService.GetAuditHistory(lei, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve audit history"})
		return
	}

	c.JSON(http.StatusOK, audits)
}

// TriggerFullSync manually triggers a full sync
// @Summary Trigger full LEI sync
// @Description Manually trigger a full LEI data synchronization
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/full [post]
func (h *LEIHandler) TriggerFullSync(c *gin.Context) {
	if err := h.schedulerService.TriggerFullSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger Level 1 LEI Records sync (DAILY_FULL)"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Level 1 LEI Records sync triggered (DAILY_FULL)"})
}

// TriggerMasterDataSync manually triggers a reference/master data sync
// @Summary Trigger master data sync
// @Description Manually trigger countries/currencies/languages synchronization
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/masterdata [post]
func (h *LEIHandler) TriggerMasterDataSync(c *gin.Context) {
	if st, err := h.leiService.GetProcessingStatus("MASTER_DATA_SYNC"); err == nil && st.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "MASTER_DATA_SYNC is already running"})
		return
	}
	if err := h.schedulerService.TriggerMasterDataSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger master data sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Master data sync triggered"})
}

// TriggerGLEIFReferenceSync manually triggers a GLEIF reference code-list sync
// @Summary Trigger GLEIF reference sync
// @Description Manually trigger synchronization of GLEIF reference code lists (registration authorities,
// entity legal forms, organizational roles, legal jurisdictions).
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/gleif-reference [post]
func (h *LEIHandler) TriggerGLEIFReferenceSync(c *gin.Context) {
	if err := h.schedulerService.TriggerGLEIFReferenceSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger GLEIF reference sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "GLEIF reference sync triggered"})
}

// TriggerDeltaSync manually triggers a delta sync
// @Summary Trigger delta LEI sync
// @Description Manually trigger a delta LEI data synchronization
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/delta [post]
func (h *LEIHandler) TriggerDeltaSync(c *gin.Context) {
	if err := h.schedulerService.TriggerDeltaSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger delta sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Delta sync triggered"})
}

// TriggerLevel2Sync manually triggers a Level 2 (Relationship Records + Reporting Exceptions) sync
// @Summary Trigger Level 2 LEI sync
// @Description Manually trigger a GLEIF Level 2 data synchronization (Relationship Records + Reporting Exceptions). Runs independently of the
// scheduled Level 1 full sync so an operator can re-run just the Level 2 pipeline intra-day.
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2 [post]
func (h *LEIHandler) TriggerLevel2Sync(c *gin.Context) {
	if err := h.schedulerService.TriggerLevel2Sync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger Level 2 sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Level 2 sync triggered (Relationship Records → Reporting Exceptions)"})
}

// TriggerLevel2RRSync manually triggers the Level 2 Relationship Records step.
// @Summary Trigger Level 2 Relationship Records sync
// @Description Manually trigger the Level 2 Relationship Records job.
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2/rr [post]
func (h *LEIHandler) TriggerLevel2RRSync(c *gin.Context) {
	if err := h.schedulerService.TriggerLevel2RRSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger Level 2 Relationship Records sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Level 2 Relationship Records sync triggered"})
}

// TriggerLevel2REPEXSync manually triggers the Level 2 Reporting Exceptions step.
// @Summary Trigger Level 2 Reporting Exceptions sync
// @Description Manually trigger the Level 2 Reporting Exceptions job.
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2/repex [post]
func (h *LEIHandler) TriggerLevel2REPEXSync(c *gin.Context) {
	if err := h.schedulerService.TriggerLevel2REPEXSync(); err != nil {
		if errors.Is(err, service.ErrJobRunning) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger Level 2 Reporting Exceptions sync"})
		}
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"message": "Level 2 Reporting Exceptions sync triggered"})
}

// GetProcessingStatus retrieves processing status for a job type
// @Summary Get processing status
// @Description Get the current processing status for LEI sync jobs
// @Tags LEI
// @Accept json
// @Produce json
// @Param jobType path string true "Job type (DAILY_FULL, DAILY_DELTA, LEVEL2_RR, or LEVEL2_REPEX)"
// @Success 200 {object} domain.FileProcessingStatus
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/status/{jobType} [get]
func (h *LEIHandler) GetProcessingStatus(c *gin.Context) {
	jobType := c.Param("jobType")

	status, err := h.leiService.GetProcessingStatus(jobType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Processing status not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetImportProcessingFailures lists LEI import record-level processing failures.
// @Summary List LEI import processing failures
// @Description Get persisted Level 1/Level 2 processing failures with open/resolved lifecycle filtering
// @Tags LEI
// @Accept json
// @Produce json
// @Param jobType query string false "Job type filter (DAILY_FULL, DAILY_DELTA, LEVEL2_RR, LEVEL2_REPEX)"
// @Param openOnly query bool false "When true (default), returns only unresolved failures" default(true)
// @Param limit query int false "Max rows" default(100)
// @Param offset query int false "Offset" default(0)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/import-failures [get]
func (h *LEIHandler) GetImportProcessingFailures(c *gin.Context) {
	if h.level2Service == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Level 2 service not configured"})
		return
	}

	jobType := normalizeFailuresJobType(c.Query("jobType"))
	if jobType == "INVALID" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "jobType must be DAILY_FULL, DAILY_DELTA, LEVEL2_RR, or LEVEL2_REPEX"})
		return
	}

	openOnly := true
	if rawOpenOnly := c.Query("openOnly"); rawOpenOnly != "" {
		openOnly = rawOpenOnly != "false" && rawOpenOnly != "0"
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if offset < 0 {
		offset = 0
	}

	items, total, err := h.level2Service.GetProcessingFailures(jobType, openOnly, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LEI import processing failures"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     items,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
		"open_only": openOnly,
		"job_type":  jobType,
	})
}

// GetLevel2ProcessingFailures is kept as a backwards-compatible alias.
// Deprecated: use /api/v1/lei/import-failures.
// @Summary List LEI import processing failures (Deprecated)
// @Description Deprecated endpoint. Use /api/v1/lei/import-failures instead.
// @Tags LEI
// @Accept json
// @Produce json
// @Param jobType query string false "Job type filter (DAILY_FULL, DAILY_DELTA, LEVEL2_RR, LEVEL2_REPEX)"
// @Param openOnly query bool false "When true (default), returns only unresolved failures" default(true)
// @Param limit query int false "Max rows" default(100)
// @Param offset query int false "Offset" default(0)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/level2/failures [get]
func (h *LEIHandler) GetLevel2ProcessingFailures(c *gin.Context) {
	c.Header("Deprecation", "true")
	c.Header("Sunset", "Tue, 30 Jun 2026 23:59:59 GMT")
	c.Header("Link", "</api/v1/lei/import-failures>; rel=\"successor-version\"")
	c.Header("Warning", "299 - \"Deprecated API: use /api/v1/lei/import-failures\"")
	h.GetImportProcessingFailures(c)
}

func normalizeFailuresJobType(jobType string) string {
	switch jobType {
	case "":
		return ""
	case "LEVEL1_FULL", "DAILY_FULL":
		return "LEVEL1_FULL"
	case "LEVEL1_DELTA", "DAILY_DELTA":
		return "LEVEL1_DELTA"
	case "LEVEL2_RR", "LEVEL2_REPEX":
		return jobType
	default:
		return "INVALID"
	}
}

// ResumeProcessing resumes processing of a source file
// @Summary Resume file processing
// @Description Resume processing of a source file from where it left off
// @Tags LEI
// @Accept json
// @Produce json
// @Param id path string true "Source file ID"
// @Success 202 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/source-file/{id}/resume [post]
func (h *LEIHandler) ResumeProcessing(c *gin.Context) {
	idStr := c.Param("id")

	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid source file ID"})
		return
	}

	go func() {
		if err := h.leiService.ProcessSourceFile(id); err != nil {
			log.Error().Err(err).Str("file_id", id.String()).Msg("Failed to process source file")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Processing resumed"})
}
