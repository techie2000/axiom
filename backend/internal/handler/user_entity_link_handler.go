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
// @Summary List user-entity links
// @Description Returns active links by default; set include_revoked=true to include revoked links.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Limit" default(50)
// @Param offset query int false "Offset" default(0)
// @Param include_revoked query bool false "Include revoked links"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]string
// @Router /api/v1/user-entity-links [get]
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
// @Summary List links by user
// @Description Returns all links (active, expired, and revoked) for a specific user.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param user_id path string true "User ID (UUID)"
// @Success 200 {array} domain.UserEntityLink
// @Failure 400 {object} map[string]string
// @Router /api/v1/user-entity-links/user/{user_id} [get]
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
// @Summary List links by LEI
// @Description Returns all user links associated with the specified LEI.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param lei path string true "LEI code"
// @Success 200 {array} domain.UserEntityLink
// @Failure 500 {object} map[string]string
// @Router /api/v1/user-entity-links/lei/{lei} [get]
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
// @Summary Get user-entity link
// @Description Returns a single user-entity link by ID.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param id path string true "Link ID (UUID)"
// @Success 200 {object} domain.UserEntityLink
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/user-entity-links/{id} [get]
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
// @Summary Grant user-entity link
// @Description Creates a new user-entity link.
// @Tags User Entity Links
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body service.GrantEntityLinkRequest true "Grant request"
// @Success 201 {object} domain.UserEntityLink
// @Failure 400 {object} map[string]string
// @Failure 422 {object} map[string]string
// @Router /api/v1/user-entity-links [post]
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
// @Summary Update user-entity link
// @Description Updates role, children scope, expiry, or notes on an existing link.
// @Tags User Entity Links
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Link ID (UUID)"
// @Param request body service.UpdateEntityLinkRequest true "Update request"
// @Success 200 {object} domain.UserEntityLink
// @Failure 400 {object} map[string]string
// @Failure 422 {object} map[string]string
// @Router /api/v1/user-entity-links/{id} [put]
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
// @Summary Revoke user-entity link
// @Description Soft-deletes a link by setting revoked_at.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param id path string true "Link ID (UUID)"
// @Success 200 {object} map[string]string
// @Failure 422 {object} map[string]string
// @Router /api/v1/user-entity-links/{id}/revoke [post]
func (h *UserEntityLinkHandler) Revoke(c *gin.Context) {
	id := c.Param("id")
	adminID := extractUserID(c)

	if err := h.svc.Revoke(id, adminID); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User-entity link revoked"})
}

// Unrevoke restores a previously revoked user-entity link.
// POST /api/v1/user-entity-links/:id/unrevoke
// @Summary Unrevoke user-entity link
// @Description Restores a revoked link by clearing revoked_at.
// @Tags User Entity Links
// @Produce json
// @Security BearerAuth
// @Param id path string true "Link ID (UUID)"
// @Success 200 {object} map[string]string
// @Failure 422 {object} map[string]string
// @Router /api/v1/user-entity-links/{id}/unrevoke [post]
func (h *UserEntityLinkHandler) Unrevoke(c *gin.Context) {
	id := c.Param("id")
	adminID := extractUserID(c)

	if err := h.svc.Unrevoke(id, adminID); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User-entity link unrevoked"})
}
