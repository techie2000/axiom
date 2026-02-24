package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/service"
)

// LEIHandler handles LEI-related HTTP requests
type LEIHandler struct {
	leiService       service.LEIService
	schedulerService service.SchedulerService
}

// NewLEIHandler creates a new LEI handler
func NewLEIHandler(leiService service.LEIService, schedulerService service.SchedulerService) *LEIHandler {
	return &LEIHandler{
		leiService:       leiService,
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
	sortBy := c.Query("sortBy")       // Empty if not provided - repository will use Hybrid Approach
	sortOrder := c.Query("sortOrder") // Empty if not provided - repository will choose based on context

	// Get visible columns from frontend for dynamic SELECT optimization
	// Default to core columns including other_names for name search display
	columns := c.DefaultQuery("columns", "id,lei,legal_name,other_names,entity_status,entity_category,legal_address_country,last_update_date")

	// Allow up to 501 records (frontend requests itemsPerPage + 1 to detect more pages)
	if limit > 501 {
		limit = 501
	}

	records, err := h.leiService.GetAllLEIWithFilters(limit, offset, search, status, category, country, sortBy, sortOrder, columns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LEI records"})
		return
	}

	c.JSON(http.StatusOK, records)
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
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/full [post]
func (h *LEIHandler) TriggerFullSync(c *gin.Context) {
	masterDataStatus, err := h.leiService.GetProcessingStatus("MASTER_DATA_SYNC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate master data sync status"})
		return
	}

	fullStatus, err := h.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate full sync status"})
		return
	}

	if masterDataStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Cannot trigger Full Sync while MASTER_DATA_SYNC is running",
		})
		return
	}

	if fullStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{
			"error": "DAILY_FULL is already running",
		})
		return
	}

	go func() {
		if err := h.schedulerService.RunDailyFullSync(); err != nil {
			log.Error().Err(err).Msg("Failed to run daily full sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Full sync triggered"})
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
	masterDataStatus, err := h.leiService.GetProcessingStatus("MASTER_DATA_SYNC")
	if err == nil && masterDataStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "MASTER_DATA_SYNC is already running"})
		return
	}

	go func() {
		if err := h.schedulerService.RunDailyMasterDataSync(); err != nil {
			log.Error().Err(err).Msg("Failed to run master data sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Master data sync triggered"})
}

// TriggerDeltaSync manually triggers a delta sync
// @Summary Trigger delta LEI sync
// @Description Manually trigger a delta LEI data synchronization
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/delta [post]
func (h *LEIHandler) TriggerDeltaSync(c *gin.Context) {
	deltaStatus, err := h.leiService.GetProcessingStatus("DAILY_DELTA")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate delta sync status"})
		return
	}

	if deltaStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "DAILY_DELTA is already running"})
		return
	}

	fullStatus, err := h.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate full sync status"})
		return
	}

	if fullStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger DAILY_DELTA while DAILY_FULL is running"})
		return
	}

	go func() {
		if err := h.schedulerService.RunDailyDeltaSync(); err != nil {
			log.Error().Err(err).Msg("Failed to run daily delta sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Delta sync triggered"})
}

// TriggerLevel2Sync manually triggers a Level 2 (Relationship Records + Reporting Exceptions) sync
// @Summary Trigger Level 2 LEI sync
// @Description Manually trigger a GLEIF Level 2 data synchronization (RR + REPEX). Runs independently of the
// scheduled Level 1 full sync so an operator can re-run just the Level 2 pipeline intra-day.
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2 [post]
func (h *LEIHandler) TriggerLevel2Sync(c *gin.Context) {
	fullStatus, err := h.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate full sync status"})
		return
	}

	if fullStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Cannot trigger Level 2 while Full Sync (DAILY_FULL) is running",
		})
		return
	}

	rrStatus, rrErr := h.leiService.GetProcessingStatus("LEVEL2_RR")
	if rrErr == nil && rrStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger Level 2 while LEVEL2_RR is running"})
		return
	}

	repexStatus, repexErr := h.leiService.GetProcessingStatus("LEVEL2_REPEX")
	if repexErr == nil && repexStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger Level 2 while LEVEL2_REPEX is running"})
		return
	}

	go func() {
		if err := h.schedulerService.RunLevel2Sync(); err != nil {
			log.Error().Err(err).Msg("Failed to run Level 2 sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "Level 2 sync triggered (LEVEL2_RR → LEVEL2_REPEX)"})
}

// TriggerLevel2RRSync manually triggers Level 2 RR step
// @Summary Trigger Level 2 RR sync
// @Description Manually trigger the LEVEL2_RR job
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2/rr [post]
func (h *LEIHandler) TriggerLevel2RRSync(c *gin.Context) {
	fullStatus, err := h.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate full sync status"})
		return
	}
	if fullStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger LEVEL2_RR while DAILY_FULL is running"})
		return
	}

	rrStatus, rrErr := h.leiService.GetProcessingStatus("LEVEL2_RR")
	if rrErr == nil && rrStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "LEVEL2_RR is already running"})
		return
	}

	go func() {
		if err := h.schedulerService.RunLevel2RRSync(); err != nil {
			log.Error().Err(err).Msg("Failed to run LEVEL2_RR sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "LEVEL2_RR sync triggered"})
}

// TriggerLevel2REPEXSync manually triggers Level 2 REPEX step
// @Summary Trigger Level 2 REPEX sync
// @Description Manually trigger the LEVEL2_REPEX job
// @Tags LEI
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/sync/level2/repex [post]
func (h *LEIHandler) TriggerLevel2REPEXSync(c *gin.Context) {
	fullStatus, err := h.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate full sync status"})
		return
	}
	if fullStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger LEVEL2_REPEX while DAILY_FULL is running"})
		return
	}

	rrStatus, rrErr := h.leiService.GetProcessingStatus("LEVEL2_RR")
	if rrErr == nil && rrStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "Cannot trigger LEVEL2_REPEX while LEVEL2_RR is running"})
		return
	}

	repexStatus, repexErr := h.leiService.GetProcessingStatus("LEVEL2_REPEX")
	if repexErr == nil && repexStatus.Status == "RUNNING" {
		c.JSON(http.StatusConflict, gin.H{"error": "LEVEL2_REPEX is already running"})
		return
	}

	go func() {
		if err := h.schedulerService.RunLevel2REPEXSync(); err != nil {
			log.Error().Err(err).Msg("Failed to run LEVEL2_REPEX sync")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "LEVEL2_REPEX sync triggered"})
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
