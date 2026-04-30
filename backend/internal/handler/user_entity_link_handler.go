package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/techie2000/axiom/internal/service"
)

// UserEntityLinkHandler handles HTTP requests for user–entity identity links.
type UserEntityLinkHandler struct {
	svc service.UserEntityLinkService
}

// NewUserEntityLinkHandler creates a UserEntityLinkHandler.
func NewUserEntityLinkHandler(svc service.UserEntityLinkService) *UserEntityLinkHandler {
	return &UserEntityLinkHandler{svc: svc}
}

// ListActive returns all currently effective user–entity links with pagination.
// GET /api/v1/user-entity-links
func (h *UserEntityLinkHandler) ListActive(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	includeRevoked := strings.EqualFold(c.Query("include_revoked"), "true")
	if limit < 1 || limit > 200 {
		limit = 50
	}

	var (
		links any
		err   error
	)
	if includeRevoked {
		links, err = h.svc.ListAll(limit, offset)
	} else {
		links, err = h.svc.ListActive(limit, offset)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user-entity links"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": links, "limit": limit, "offset": offset})
}

// ListByUser returns all links (active and revoked) for a specific user.
// GET /api/v1/user-entity-links/user/:user_id
func (h *UserEntityLinkHandler) ListByUser(c *gin.Context) {
	userID := c.Param("user_id")
	links, err := h.svc.ListByUser(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, links)
}

// ListByLEI returns all links for a specific LEI entity.
// GET /api/v1/user-entity-links/lei/:lei
func (h *UserEntityLinkHandler) ListByLEI(c *gin.Context) {
	lei := c.Param("lei")
	links, err := h.svc.ListByLEI(lei)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve links for LEI"})
		return
	}
	c.JSON(http.StatusOK, links)
}

// Get returns a single user–entity link by ID.
// GET /api/v1/user-entity-links/:id
func (h *UserEntityLinkHandler) Get(c *gin.Context) {
	id := c.Param("id")
	link, err := h.svc.GetByID(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if link == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User-entity link not found"})
		return
	}
	c.JSON(http.StatusOK, link)
}

// Grant creates a new user–entity identity link.
// POST /api/v1/user-entity-links
func (h *UserEntityLinkHandler) Grant(c *gin.Context) {
	var req service.GrantEntityLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	link, err := h.svc.Grant(req, adminID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, link)
}

// Update modifies the mutable attributes of an existing link.
// PUT /api/v1/user-entity-links/:id
func (h *UserEntityLinkHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req service.UpdateEntityLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adminID := extractUserID(c)
	link, err := h.svc.Update(id, req, adminID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, link)
}

// Revoke soft-deletes an active user–entity link.
// POST /api/v1/user-entity-links/:id/revoke
func (h *UserEntityLinkHandler) Revoke(c *gin.Context) {
	id := c.Param("id")
	adminID := extractUserID(c)

	if err := h.svc.Revoke(id, adminID); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User-entity link revoked"})
}
