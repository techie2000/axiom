package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/techie2000/axiom/internal/service"
)

// ProvisionalLEIHandler handles HTTP requests for Axiom-issued provisional LEI records.
type ProvisionalLEIHandler struct {
	svc service.ProvisionalLEIService
}

type succeedProvisionalLEIRequest struct {
	OfficialLEI string `json:"official_lei" binding:"required"`
}

// NewProvisionalLEIHandler creates a ProvisionalLEIHandler.
func NewProvisionalLEIHandler(svc service.ProvisionalLEIService) *ProvisionalLEIHandler {
	return &ProvisionalLEIHandler{svc: svc}
}

// List returns all provisional LEI records with pagination.
// GET /api/v1/lei/provisional
// @Summary List provisional LEI records
// @Description Returns provisional LEI records with pagination.
// @Tags Provisional LEI
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Limit" default(50)
// @Param offset query int false "Offset" default(0)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/provisional [get]
func (h *ProvisionalLEIHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 200 {
		limit = 50
	}

	records, total, err := h.svc.List(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve provisional LEI records"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records, "total": total, "limit": limit, "offset": offset})
}

// Get returns a single provisional LEI record by its code.
// GET /api/v1/lei/provisional/:lei
// @Summary Get provisional LEI record
// @Description Returns a single provisional LEI record by LEI code.
// @Tags Provisional LEI
// @Produce json
// @Security BearerAuth
// @Param lei path string true "Provisional LEI code"
// @Success 200 {object} domain.LEIRecord
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/provisional/{lei} [get]
func (h *ProvisionalLEIHandler) Get(c *gin.Context) {
	lei := c.Param("lei")
	record, err := h.svc.Get(lei)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve provisional LEI record"})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provisional LEI not found"})
		return
	}
	c.JSON(http.StatusOK, record)
}

// Create issues a new provisional LEI record.
// POST /api/v1/lei/provisional
// @Summary Create provisional LEI record
// @Description Issues a new provisional LEI record.
// @Tags Provisional LEI
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body service.CreateProvisionalLEIRequest true "Create provisional LEI request"
// @Success 201 {object} domain.LEIRecord
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/provisional [post]
func (h *ProvisionalLEIHandler) Create(c *gin.Context) {
	var req service.CreateProvisionalLEIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	record, err := h.svc.Create(req, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, record)
}

// Update modifies the mutable fields of an existing provisional LEI record.
// PUT /api/v1/lei/provisional/:lei
// @Summary Update provisional LEI record
// @Description Updates mutable fields of an existing provisional LEI record.
// @Tags Provisional LEI
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param lei path string true "Provisional LEI code"
// @Param request body service.UpdateProvisionalLEIRequest true "Update provisional LEI request"
// @Success 200 {object} domain.LEIRecord
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/lei/provisional/{lei} [put]
func (h *ProvisionalLEIHandler) Update(c *gin.Context) {
	lei := c.Param("lei")

	var req service.UpdateProvisionalLEIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	record, err := h.svc.Update(lei, req, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, record)
}

// Succeed marks a provisional LEI as succeeded by a successor LEI.
// POST /api/v1/lei/provisional/:lei/succeed
// @Summary Succeed provisional LEI
// @Description Marks a provisional LEI as succeeded by a successor LEI.
// @Tags Provisional LEI
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param lei path string true "Provisional LEI code"
// @Param request body handler.succeedProvisionalLEIRequest true "Succeed provisional LEI request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 422 {object} map[string]string
// @Router /api/v1/lei/provisional/{lei}/succeed [post]
func (h *ProvisionalLEIHandler) Succeed(c *gin.Context) {
	provisionalLEI := c.Param("lei")

	var body succeedProvisionalLEIRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	if err := h.svc.Succeed(provisionalLEI, body.OfficialLEI, adminID); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":       "Provisional LEI linked to successor LEI",
		"successor_lei": body.OfficialLEI,
		"official_lei":  body.OfficialLEI,
	})
}
