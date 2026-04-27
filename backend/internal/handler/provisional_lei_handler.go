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

// NewProvisionalLEIHandler creates a ProvisionalLEIHandler.
func NewProvisionalLEIHandler(svc service.ProvisionalLEIService) *ProvisionalLEIHandler {
	return &ProvisionalLEIHandler{svc: svc}
}

// List returns all provisional LEI records with pagination.
// GET /api/v1/lei/provisional
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

// Succeed marks a provisional LEI as succeeded by an official GLEIF LEI.
// POST /api/v1/lei/provisional/:lei/succeed
func (h *ProvisionalLEIHandler) Succeed(c *gin.Context) {
	provisionalLEI := c.Param("lei")

	var body struct {
		OfficialLEI string `json:"official_lei" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	if err := h.svc.Succeed(provisionalLEI, body.OfficialLEI, adminID); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Provisional LEI succeeded by official LEI", "official_lei": body.OfficialLEI})
}
