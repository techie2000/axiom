package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/service"
)

// Handlers holds all handler groups
type Handlers struct {
	Auth            *AuthHandler
	Country         *CountryHandler
	Currency        *CurrencyHandler
	Language        *LanguageHandler
	Entity          *EntityHandler
	Instrument      *InstrumentHandler
	Account         *AccountHandler
	SSI             *SSIHandler
	LEI             *LEIHandler
	DataAcquisition *DataAcquisitionHandler
	CodeMapping     *CodeMappingHandler
	UserPreference  *UserPreferenceHandler
	UITranslation   *UITranslationHandler
	ProvisionalLEI  *ProvisionalLEIHandler
	UserEntityLink  *UserEntityLinkHandler
}

// NewHandlers creates a new handlers instance
func NewHandlers(services *service.Services, schedulerService service.SchedulerService) *Handlers {
	return &Handlers{
		Auth:            NewAuthHandler(services.Auth),
		Country:         NewCountryHandler(services.Country),
		Currency:        NewCurrencyHandler(services.Currency),
		Language:        NewLanguageHandler(services.Language),
		Entity:          NewEntityHandler(services.Entity),
		Instrument:      NewInstrumentHandler(services.Instrument),
		Account:         NewAccountHandler(services.Account),
		SSI:             NewSSIHandler(services.SSI),
		LEI:             NewLEIHandlerWithLevel2(services.LEI, services.LEILevel2, schedulerService),
		DataAcquisition: NewDataAcquisitionHandler(),
		CodeMapping:     NewCodeMappingHandler(services.CodeMapping),
		UserPreference:  NewUserPreferenceHandler(services.UserPreference),
		UITranslation:   NewUITranslationHandler(services.UITranslation),
		ProvisionalLEI:  NewProvisionalLEIHandler(services.ProvisionalLEI),
		UserEntityLink:  NewUserEntityLinkHandler(services.UserEntityLink),
	}
}

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	auth service.AuthService
}

func NewAuthHandler(auth service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// loginRequest is the expected request body for POST /auth/login.
type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login godoc
// @Summary User login
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body loginRequest true "Login credentials"
// @Success 200 {object} service.LoginResponse
// @Failure 400 {object} object{error=string}
// @Failure 401 {object} object{error=string}
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	resp, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Register godoc
// @Summary Request a new user account
// @Description Submit a registration request that an admin must approve
// @Tags auth
// @Accept json
// @Produce json
// @Param user body service.RegisterRequest true "Registration details"
// @Success 201 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.auth.Register(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Registration request submitted. An admin will review your account."})
}

// userResponse is a safe subset of domain.User for API responses.
type userResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Username    string  `json:"username"`
	FullName    string  `json:"full_name"`
	Role        string  `json:"role"`
	Status      string  `json:"status"`
	IsBootstrap bool    `json:"is_bootstrap"`
	ApprovedBy  *string `json:"approved_by,omitempty"`
	ApprovedAt  *string `json:"approved_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
}

func toUserResponse(u *domain.User) userResponse {
	r := userResponse{
		ID:          u.ID.String(),
		Email:       u.Email,
		Username:    u.Username,
		FullName:    u.FullName,
		Role:        string(u.Role),
		Status:      string(u.Status),
		IsBootstrap: u.IsBootstrap,
		CreatedAt:   u.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
	if u.ApprovedBy != nil {
		s := u.ApprovedBy.String()
		r.ApprovedBy = &s
	}
	if u.ApprovedAt != nil {
		s := u.ApprovedAt.UTC().Format("2006-01-02T15:04:05Z")
		r.ApprovedAt = &s
	}
	return r
}

// ListUsers godoc
// @Summary List users (admin only)
// @Description Return users optionally filtered by status
// @Tags auth
// @Produce json
// @Param status query string false "Filter by status: pending, active, inactive"
// @Param limit query int false "Limit (default 50)"
// @Param offset query int false "Offset"
// @Success 200 {array} userResponse
// @Security BearerAuth
// @Router /auth/users [get]
func (h *AuthHandler) ListUsers(c *gin.Context) {
	status := c.Query("status")
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if err != nil || limit < 1 || limit > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
		return
	}
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid offset"})
		return
	}

	users, err := h.auth.ListUsers(status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	resp := make([]userResponse, 0, len(users))
	for _, u := range users {
		resp = append(resp, toUserResponse(u))
	}
	c.JSON(http.StatusOK, resp)
}

// extractUserID retrieves the user_id string from the gin context set by JWTAuth middleware.
func extractUserID(c *gin.Context) string {
	v, _ := c.Get("user_id")
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// ApproveUser godoc
// @Summary Approve a pending user (admin only)
// @Description Activate a user account so the user can log in
// @Tags auth
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} object{message=string}
// @Security BearerAuth
// @Router /auth/users/{id}/approve [post]
func (h *AuthHandler) ApproveUser(c *gin.Context) {
	adminID := extractUserID(c)
	userID := c.Param("id")

	if err := h.auth.ApproveUser(adminID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User approved successfully"})
}

// RejectUser godoc
// @Summary Reject/deactivate a user (admin only)
// @Description Deactivate a user account. Fails if this would remove the last active admin.
// @Tags auth
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Security BearerAuth
// @Router /auth/users/{id}/reject [post]
func (h *AuthHandler) RejectUser(c *gin.Context) {
	adminID := extractUserID(c)
	userID := c.Param("id")

	if err := h.auth.RejectUser(adminID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deactivated successfully"})
}

// updateRoleRequest is the expected body for PUT /auth/users/:id/role.
type updateRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// UpdateUserRole godoc
// @Summary Change a user's role (admin only)
// @Description Promote a user to admin or demote an admin to user. Fails if this would remove the last active admin.
// @Tags auth
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param body body updateRoleRequest true "New role"
// @Success 200 {object} object{message=string}
// @Failure 400 {object} object{error=string}
// @Security BearerAuth
// @Router /auth/users/{id}/role [put]
func (h *AuthHandler) UpdateUserRole(c *gin.Context) {
	adminID := extractUserID(c)
	userID := c.Param("id")

	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role is required"})
		return
	}

	if err := h.auth.UpdateUserRole(adminID, userID, req.Role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}

// CountryHandler handles country endpoints
type CountryHandler struct {
	service service.CountryService
}

const (
	referenceDataDefaultLimit = 1000
	referenceDataMaxLimit     = 5000
)

func NewCountryHandler(service service.CountryService) *CountryHandler {
	return &CountryHandler{service: service}
}

// List godoc
// @Summary List countries
// @Description Get list of all countries
// @Tags countries
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Country
// @Security BearerAuth
// @Router /countries [get]
func (h *CountryHandler) List(c *gin.Context) {
	// Parse and validate pagination parameters
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(referenceDataDefaultLimit)))
	if err != nil || limit < 1 || limit > referenceDataMaxLimit {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter (must be 1-5000)"})
		return
	}

	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter (must be >= 0)"})
		return
	}

	countries, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch countries"})
		return
	}

	c.JSON(http.StatusOK, countries)
}

// Get godoc
// @Summary Get country by ID
// @Description Get a single country by ID
// @Tags countries
// @Accept json
// @Produce json
// @Param id path string true "Country ID"
// @Success 200 {object} domain.Country
// @Security BearerAuth
// @Router /countries/{id} [get]
func (h *CountryHandler) Get(c *gin.Context) {
	id := c.Param("id")

	country, err := h.service.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Country not found"})
		return
	}

	c.JSON(http.StatusOK, country)
}

// Create godoc
// @Summary Create country
// @Description Create a new country
// @Tags countries
// @Accept json
// @Produce json
// @Param country body domain.Country true "Country object"
// @Success 201 {object} domain.Country
// @Security BearerAuth
// @Router /countries [post]
func (h *CountryHandler) Create(c *gin.Context) {
	var country domain.Country
	if err := c.ShouldBindJSON(&country); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := h.service.Create(&country); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create country"})
		return
	}

	c.JSON(http.StatusCreated, country)
}

// Update godoc
// @Summary Update country
// @Description Update an existing country
// @Tags countries
// @Accept json
// @Produce json
// @Param id path string true "Country ID"
// @Param country body domain.Country true "Country object"
// @Success 200 {object} domain.Country
// @Security BearerAuth
// @Router /countries/{id} [put]
func (h *CountryHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	countryID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var country domain.Country
	if err := c.ShouldBindJSON(&country); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	country.ID = countryID

	// Verify country exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Country not found"})
		return
	}

	if err := h.service.Update(&country); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update country"})
		return
	}

	c.JSON(http.StatusOK, country)
}

// Delete godoc
// @Summary Delete country
// @Description Delete a country
// @Tags countries
// @Accept json
// @Produce json
// @Param id path string true "Country ID"
// @Success 204
// @Security BearerAuth
// @Router /countries/{id} [delete]
func (h *CountryHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete country"})
		return
	}

	c.Status(http.StatusNoContent)
}

// CurrencyHandler, EntityHandler, etc. follow similar pattern
// For brevity, I'll create placeholders

type CurrencyHandler struct {
	service service.CurrencyService
}

type LanguageHandler struct {
	service service.LanguageService
}

func NewCurrencyHandler(service service.CurrencyService) *CurrencyHandler {
	return &CurrencyHandler{service: service}
}

func NewLanguageHandler(service service.LanguageService) *LanguageHandler {
	return &LanguageHandler{service: service}
}

// List godoc
// @Summary List currencies
// @Description Get list of all currencies
// @Tags currencies
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Currency
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /currencies [get]
func (h *CurrencyHandler) List(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(referenceDataDefaultLimit)))
	if err != nil || limit < 1 || limit > referenceDataMaxLimit {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter (must be 1-5000)"})
		return
	}

	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter (must be >= 0)"})
		return
	}

	currencies, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch currencies"})
		return
	}
	c.JSON(http.StatusOK, currencies)
}

// Get godoc
// @Summary Get currency by ID
// @Description Get a single currency by ID
// @Tags currencies
// @Accept json
// @Produce json
// @Param id path string true "Currency ID"
// @Success 200 {object} domain.Currency
// @Failure 404 {object} object{error=string}
// @Router /currencies/{id} [get]
func (h *CurrencyHandler) Get(c *gin.Context) {
	currency, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Currency not found"})
		return
	}
	c.JSON(http.StatusOK, currency)
}

// Create godoc
// @Summary Create currency
// @Description Create a new currency
// @Tags currencies
// @Accept json
// @Produce json
// @Param currency body domain.Currency true "Currency object"
// @Success 201 {object} domain.Currency
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /currencies [post]
func (h *CurrencyHandler) Create(c *gin.Context) {
	var currency domain.Currency
	if err := c.ShouldBindJSON(&currency); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.service.Create(&currency); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create currency"})
		return
	}
	c.JSON(http.StatusCreated, currency)
}

// Update godoc
// @Summary Update currency
// @Description Update an existing currency
// @Tags currencies
// @Accept json
// @Produce json
// @Param id path string true "Currency ID"
// @Param currency body domain.Currency true "Currency object"
// @Success 200 {object} domain.Currency
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /currencies/{id} [put]
func (h *CurrencyHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	currencyID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var currency domain.Currency
	if err := c.ShouldBindJSON(&currency); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	currency.ID = currencyID

	// Verify currency exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Currency not found"})
		return
	}

	if err := h.service.Update(&currency); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update currency"})
		return
	}
	c.JSON(http.StatusOK, currency)
}

// Delete godoc
// @Summary Delete currency
// @Description Delete a currency
// @Tags currencies
// @Accept json
// @Produce json
// @Param id path string true "Currency ID"
// @Success 204
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /currencies/{id} [delete]
func (h *CurrencyHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete currency"})
		return
	}
	c.Status(http.StatusNoContent)
}

// List godoc
// @Summary List languages
// @Description Get list of all languages
// @Tags languages
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Language
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Router /languages [get]
func (h *LanguageHandler) List(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(referenceDataDefaultLimit)))
	if err != nil || limit < 1 || limit > referenceDataMaxLimit {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter (must be 1-5000)"})
		return
	}

	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter (must be >= 0)"})
		return
	}

	languages, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch languages"})
		return
	}

	c.JSON(http.StatusOK, languages)
}

// Placeholder handlers for other entities
type EntityHandler struct{ service service.EntityService }
type InstrumentHandler struct{ service service.InstrumentService }
type AccountHandler struct{ service service.AccountService }
type SSIHandler struct{ service service.SSIService }
type DataAcquisitionHandler struct{}

func NewEntityHandler(s service.EntityService) *EntityHandler { return &EntityHandler{service: s} }
func NewInstrumentHandler(s service.InstrumentService) *InstrumentHandler {
	return &InstrumentHandler{service: s}
}
func NewAccountHandler(s service.AccountService) *AccountHandler { return &AccountHandler{service: s} }
func NewSSIHandler(s service.SSIService) *SSIHandler             { return &SSIHandler{service: s} }
func NewDataAcquisitionHandler() *DataAcquisitionHandler         { return &DataAcquisitionHandler{} }

// Implement CRUD methods for remaining handlers
// List godoc
// @Summary List entities
// @Description Get list of all entities
// @Tags entities
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Entity
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /entities [get]
func (h *EntityHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	entities, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch entities"})
		return
	}
	c.JSON(http.StatusOK, entities)
}

// Get godoc
// @Summary Get entity by ID
// @Description Get a single entity by ID
// @Tags entities
// @Accept json
// @Produce json
// @Param id path string true "Entity ID"
// @Success 200 {object} domain.Entity
// @Failure 404 {object} object{error=string}
// @Security BearerAuth
// @Router /entities/{id} [get]
func (h *EntityHandler) Get(c *gin.Context) {
	entity, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}
	c.JSON(http.StatusOK, entity)
}

// Create godoc
// @Summary Create entity
// @Description Create a new entity
// @Tags entities
// @Accept json
// @Produce json
// @Param entity body domain.Entity true "Entity object"
// @Success 201 {object} domain.Entity
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /entities [post]
func (h *EntityHandler) Create(c *gin.Context) {
	var entity domain.Entity
	if err := c.ShouldBindJSON(&entity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.service.Create(&entity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create entity"})
		return
	}
	c.JSON(http.StatusCreated, entity)
}

// Update godoc
// @Summary Update entity
// @Description Update an existing entity
// @Tags entities
// @Accept json
// @Produce json
// @Param id path string true "Entity ID"
// @Param entity body domain.Entity true "Entity object"
// @Success 200 {object} domain.Entity
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /entities/{id} [put]
func (h *EntityHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	entityID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var entity domain.Entity
	if err := c.ShouldBindJSON(&entity); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	entity.ID = entityID

	// Verify entity exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entity not found"})
		return
	}

	if err := h.service.Update(&entity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update entity"})
		return
	}
	c.JSON(http.StatusOK, entity)
}

// Delete godoc
// @Summary Delete entity
// @Description Delete an entity
// @Tags entities
// @Accept json
// @Produce json
// @Param id path string true "Entity ID"
// @Success 204
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /entities/{id} [delete]
func (h *EntityHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete entity"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Instrument handler methods
// List godoc
// @Summary List instruments
// @Description Get list of all instruments
// @Tags instruments
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Instrument
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /instruments [get]
func (h *InstrumentHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	instruments, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch instruments"})
		return
	}
	c.JSON(http.StatusOK, instruments)
}

// Get godoc
// @Summary Get instrument by ID
// @Description Get a single instrument by ID
// @Tags instruments
// @Accept json
// @Produce json
// @Param id path string true "Instrument ID"
// @Success 200 {object} domain.Instrument
// @Failure 404 {object} object{error=string}
// @Security BearerAuth
// @Router /instruments/{id} [get]
func (h *InstrumentHandler) Get(c *gin.Context) {
	instrument, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Instrument not found"})
		return
	}
	c.JSON(http.StatusOK, instrument)
}

// Create godoc
// @Summary Create instrument
// @Description Create a new instrument
// @Tags instruments
// @Accept json
// @Produce json
// @Param instrument body domain.Instrument true "Instrument object"
// @Success 201 {object} domain.Instrument
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /instruments [post]
func (h *InstrumentHandler) Create(c *gin.Context) {
	var instrument domain.Instrument
	if err := c.ShouldBindJSON(&instrument); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.service.Create(&instrument); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create instrument"})
		return
	}
	c.JSON(http.StatusCreated, instrument)
}

// Update godoc
// @Summary Update instrument
// @Description Update an existing instrument
// @Tags instruments
// @Accept json
// @Produce json
// @Param id path string true "Instrument ID"
// @Param instrument body domain.Instrument true "Instrument object"
// @Success 200 {object} domain.Instrument
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /instruments/{id} [put]
func (h *InstrumentHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	instrumentID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var instrument domain.Instrument
	if err := c.ShouldBindJSON(&instrument); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	instrument.ID = instrumentID

	// Verify instrument exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Instrument not found"})
		return
	}

	if err := h.service.Update(&instrument); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update instrument"})
		return
	}
	c.JSON(http.StatusOK, instrument)
}

// Delete godoc
// @Summary Delete instrument
// @Description Delete an instrument
// @Tags instruments
// @Accept json
// @Produce json
// @Param id path string true "Instrument ID"
// @Success 204
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /instruments/{id} [delete]
func (h *InstrumentHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete instrument"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Account handler methods
// List godoc
// @Summary List accounts
// @Description Get list of all accounts
// @Tags accounts
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.Account
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /accounts [get]
func (h *AccountHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	accounts, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch accounts"})
		return
	}
	c.JSON(http.StatusOK, accounts)
}

// Get godoc
// @Summary Get account by ID
// @Description Get a single account by ID
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 200 {object} domain.Account
// @Failure 404 {object} object{error=string}
// @Security BearerAuth
// @Router /accounts/{id} [get]
func (h *AccountHandler) Get(c *gin.Context) {
	account, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}
	c.JSON(http.StatusOK, account)
}

// Create godoc
// @Summary Create account
// @Description Create a new account
// @Tags accounts
// @Accept json
// @Produce json
// @Param account body domain.Account true "Account object"
// @Success 201 {object} domain.Account
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /accounts [post]
func (h *AccountHandler) Create(c *gin.Context) {
	var account domain.Account
	if err := c.ShouldBindJSON(&account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.service.Create(&account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}
	c.JSON(http.StatusCreated, account)
}

// Update godoc
// @Summary Update account
// @Description Update an existing account
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Param account body domain.Account true "Account object"
// @Success 200 {object} domain.Account
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /accounts/{id} [put]
func (h *AccountHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	accountID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var account domain.Account
	if err := c.ShouldBindJSON(&account); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	account.ID = accountID

	// Verify account exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	if err := h.service.Update(&account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}
	c.JSON(http.StatusOK, account)
}

// Delete godoc
// @Summary Delete account
// @Description Delete an account
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 204
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /accounts/{id} [delete]
func (h *AccountHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	c.Status(http.StatusNoContent)
}

// SSI handler methods
// List godoc
// @Summary List SSIs
// @Description Get list of all settlement standing instructions
// @Tags ssis
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} handler.ssiListItemResponse
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /ssis [get]
func (h *SSIHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	ssis, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch SSIs"})
		return
	}

	response := make([]ssiListItemResponse, 0, len(ssis))
	for _, item := range ssis {
		response = append(response, mapSSIToListItem(item))
	}

	c.JSON(http.StatusOK, response)
}

// Get godoc
// @Summary Get SSI by ID
// @Description Get a single settlement standing instruction by ID
// @Tags ssis
// @Accept json
// @Produce json
// @Param id path string true "SSI ID"
// @Success 200 {object} handler.ssiListItemResponse
// @Failure 404 {object} object{error=string}
// @Security BearerAuth
// @Router /ssis/{id} [get]
func (h *SSIHandler) Get(c *gin.Context) {
	ssi, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SSI not found"})
		return
	}
	c.JSON(http.StatusOK, mapSSIToListItem(ssi))
}

// Create godoc
// @Summary Create SSI
// @Description Create a new settlement standing instruction
// @Tags ssis
// @Accept json
// @Produce json
// @Param ssi body domain.SSI true "SSI object"
// @Success 201 {object} domain.SSI
// @Failure 400 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /ssis [post]
func (h *SSIHandler) Create(c *gin.Context) {
	var ssi domain.SSI
	if err := c.ShouldBindJSON(&ssi); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.service.Create(&ssi); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create SSI"})
		return
	}
	c.JSON(http.StatusCreated, ssi)
}

// Update godoc
// @Summary Update SSI
// @Description Update an existing settlement standing instruction
// @Tags ssis
// @Accept json
// @Produce json
// @Param id path string true "SSI ID"
// @Param ssi body domain.SSI true "SSI object"
// @Success 200 {object} domain.SSI
// @Failure 400 {object} object{error=string}
// @Failure 404 {object} object{error=string}
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /ssis/{id} [put]
func (h *SSIHandler) Update(c *gin.Context) {
	id := c.Param("id")

	// Parse UUID from path
	ssiID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var ssi domain.SSI
	if err := c.ShouldBindJSON(&ssi); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Apply the path ID to prevent updating wrong record
	ssi.ID = ssiID

	// Verify SSI exists
	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SSI not found"})
		return
	}

	if err := h.service.Update(&ssi); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update SSI"})
		return
	}
	c.JSON(http.StatusOK, ssi)
}

// Delete godoc
// @Summary Delete SSI
// @Description Delete a settlement standing instruction
// @Tags ssis
// @Accept json
// @Produce json
// @Param id path string true "SSI ID"
// @Success 204
// @Failure 500 {object} object{error=string}
// @Security BearerAuth
// @Router /ssis/{id} [delete]
func (h *SSIHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete SSI"})
		return
	}
	c.Status(http.StatusNoContent)
}

type ssiListItemResponse struct {
	ID               string `json:"id"`
	SSIReference     string `json:"ssi_reference"`
	CounterpartyName string `json:"counterparty_name"`
	AccountName      string `json:"account_name"`
	CountryCode      string `json:"country_code"`
	Currency         string `json:"currency"`
	BIC              string `json:"bic"`
	IBAN             string `json:"iban,omitempty"`
	SettlementMethod string `json:"settlement_method"`
	Status           string `json:"status"`
	UpdatedAt        string `json:"updated_at"`
}

func mapSSIToListItem(ssi *domain.SSI) ssiListItemResponse {
	if ssi == nil {
		return ssiListItemResponse{}
	}

	beneficiaryAccount := strings.TrimSpace(ssi.BeneficiaryAccount)
	countryCode := extractCountryCode(beneficiaryAccount)
	currencyCode := ""
	if ssi.SettlementCurrency != nil {
		currencyCode = strings.ToUpper(strings.TrimSpace(ssi.SettlementCurrency.Code))
	}
	bic := strings.TrimSpace(ssi.BeneficiaryBankBIC)
	if bic == "" {
		bic = strings.TrimSpace(ssi.IntermediaryBankBIC)
	}
	status := "Inactive"
	if ssi.Active {
		status = "Active"
	}

	return ssiListItemResponse{
		ID:               ssi.ID.String(),
		SSIReference:     "SSI-" + strings.ToUpper(strings.ReplaceAll(ssi.ID.String(), "-", ""))[:8],
		CounterpartyName: firstNonEmpty(strings.TrimSpace(ssi.BeneficiaryName), entityName(ssi)),
		AccountName:      firstNonEmpty(beneficiaryAccount, "—"),
		CountryCode:      countryCode,
		Currency:         firstNonEmpty(currencyCode, "—"),
		BIC:              firstNonEmpty(bic, "—"),
		IBAN:             ibanOrEmpty(beneficiaryAccount),
		SettlementMethod: settlementMethodFromType(ssi.SettlementType),
		Status:           status,
		UpdatedAt:        ssi.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func entityName(ssi *domain.SSI) string {
	if ssi.Entity == nil {
		return "—"
	}
	return strings.TrimSpace(ssi.Entity.Name)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func extractCountryCode(account string) string {
	if len(account) < 2 {
		return ""
	}
	prefix := strings.ToUpper(account[:2])
	if prefix[0] >= 'A' && prefix[0] <= 'Z' && prefix[1] >= 'A' && prefix[1] <= 'Z' {
		return prefix
	}
	return ""
}

func ibanOrEmpty(account string) string {
	if len(account) < 12 {
		return ""
	}
	prefix := strings.ToUpper(account[:2])
	if prefix[0] < 'A' || prefix[0] > 'Z' || prefix[1] < 'A' || prefix[1] > 'Z' {
		return ""
	}
	return account
}

func settlementMethodFromType(settlementType domain.SettlementType) string {
	normalized := strings.ToUpper(strings.TrimSpace(string(settlementType)))
	if normalized == "DVP" || normalized == "DAP" {
		return "Direct"
	}
	return "Agent"
}

// Data acquisition endpoints
// Import godoc
// @Summary Import data
// @Description Trigger data import job
// @Tags data-acquisition
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Security BearerAuth
// @Router /data/import [post]
func (h *DataAcquisitionHandler) Import(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Import endpoint - to be implemented"})
}

// Export godoc
// @Summary Export data
// @Description Trigger data export job
// @Tags data-acquisition
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Security BearerAuth
// @Router /data/export [post]
func (h *DataAcquisitionHandler) Export(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Export endpoint - to be implemented"})
}

// ListJobs godoc
// @Summary List data jobs
// @Description List data acquisition jobs
// @Tags data-acquisition
// @Accept json
// @Produce json
// @Success 200 {object} map[string]string
// @Security BearerAuth
// @Router /data/jobs [get]
func (h *DataAcquisitionHandler) ListJobs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "List jobs endpoint - to be implemented"})
}

// GetJob godoc
// @Summary Get data job
// @Description Get a data acquisition job by ID
// @Tags data-acquisition
// @Accept json
// @Produce json
// @Param id path string true "Job ID"
// @Success 200 {object} map[string]string
// @Security BearerAuth
// @Router /data/jobs/{id} [get]
func (h *DataAcquisitionHandler) GetJob(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Get job endpoint - to be implemented"})
}

// CodeMappingHandler handles code mapping endpoints
type CodeMappingHandler struct {
	service service.CodeMappingService
}

// NewCodeMappingHandler creates a new code mapping handler
func NewCodeMappingHandler(svc service.CodeMappingService) *CodeMappingHandler {
	return &CodeMappingHandler{service: svc}
}

// List godoc
// @Summary List code mappings
// @Description Get list of all code mappings
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Success 200 {array} domain.CodeMapping
// @Security BearerAuth
// @Router /code-mappings [get]
func (h *CodeMappingHandler) List(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit < 1 || limit > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter (must be 1-100)"})
		return
	}

	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter (must be >= 0)"})
		return
	}

	mappings, err := h.service.GetAll(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch code mappings"})
		return
	}

	c.JSON(http.StatusOK, mappings)
}

// Get godoc
// @Summary Get code mapping by ID
// @Description Get a single code mapping by ID
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param id path string true "Code Mapping ID"
// @Success 200 {object} domain.CodeMapping
// @Security BearerAuth
// @Router /code-mappings/{id} [get]
func (h *CodeMappingHandler) Get(c *gin.Context) {
	mapping, err := h.service.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Code mapping not found"})
		return
	}
	c.JSON(http.StatusOK, mapping)
}

// Create godoc
// @Summary Create code mapping
// @Description Create a new code mapping
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param mapping body domain.CodeMapping true "Code Mapping object"
// @Success 201 {object} domain.CodeMapping
// @Security BearerAuth
// @Router /code-mappings [post]
func (h *CodeMappingHandler) Create(c *gin.Context) {
	var mapping domain.CodeMapping
	if err := c.ShouldBindJSON(&mapping); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := h.service.Create(&mapping); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create code mapping"})
		return
	}

	c.JSON(http.StatusCreated, mapping)
}

// Update godoc
// @Summary Update code mapping
// @Description Update an existing code mapping
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param id path string true "Code Mapping ID"
// @Param mapping body domain.CodeMapping true "Code Mapping object"
// @Success 200 {object} domain.CodeMapping
// @Security BearerAuth
// @Router /code-mappings/{id} [put]
func (h *CodeMappingHandler) Update(c *gin.Context) {
	id := c.Param("id")

	mappingID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var mapping domain.CodeMapping
	if err := c.ShouldBindJSON(&mapping); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	mapping.ID = mappingID

	if _, err := h.service.GetByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Code mapping not found"})
		return
	}

	if err := h.service.Update(&mapping); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update code mapping"})
		return
	}

	c.JSON(http.StatusOK, mapping)
}

// Delete godoc
// @Summary Delete code mapping
// @Description Delete a code mapping
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param id path string true "Code Mapping ID"
// @Success 204
// @Security BearerAuth
// @Router /code-mappings/{id} [delete]
func (h *CodeMappingHandler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete code mapping"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Translate godoc
// @Summary Translate a code
// @Description Translate a from_code to a to_code using active mappings
// @Tags code-mappings
// @Accept json
// @Produce json
// @Param from_system query string true "Source system (e.g. ALERT)"
// @Param from_code_type query string true "Source code type (e.g. CCY_ALERT)"
// @Param from_code query string true "Source code value (e.g. SWE)"
// @Param to_code_type query string true "Target code type (e.g. CCY_CODE)"
// @Success 200 {object} object{to_code=string}
// @Router /code-mappings/translate [get]
func (h *CodeMappingHandler) Translate(c *gin.Context) {
	fromSystem := c.Query("from_system")
	fromCodeType := c.Query("from_code_type")
	fromCode := c.Query("from_code")
	toCodeType := c.Query("to_code_type")

	if fromSystem == "" || fromCodeType == "" || fromCode == "" || toCodeType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "from_system, from_code_type, from_code, and to_code_type are all required",
		})
		return
	}

	toCode, err := h.service.Translate(fromSystem, fromCodeType, fromCode, toCodeType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"to_code": toCode})
}

// UserPreferenceHandler handles user preference endpoints.
type UserPreferenceHandler struct {
	svc service.UserPreferenceService
}

// NewUserPreferenceHandler creates a new UserPreferenceHandler.
func NewUserPreferenceHandler(svc service.UserPreferenceService) *UserPreferenceHandler {
	return &UserPreferenceHandler{svc: svc}
}

// preferenceResponse is the API shape for a single preference.
type preferenceResponse struct {
	PageKey         string `json:"page_key"`
	PreferenceKey   string `json:"preference_key"`
	PreferenceValue string `json:"preference_value"`
}

// setPreferenceRequest is the expected body for PUT /preferences.
type setPreferenceRequest struct {
	PageKey         string `json:"page_key" binding:"required"`
	PreferenceKey   string `json:"preference_key" binding:"required"`
	PreferenceValue string `json:"preference_value" binding:"required"`
}

// GetPreferences godoc
// @Summary Get user preferences
// @Description Return all stored preferences for the authenticated user, optionally filtered by page_key
// @Tags preferences
// @Produce json
// @Param page_key query string false "Filter by page key (e.g. 'lei-records', 'global')"
// @Success 200 {array} preferenceResponse
// @Security BearerAuth
// @Router /preferences [get]
func (h *UserPreferenceHandler) GetPreferences(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}

	pageKey := c.Query("page_key")
	var result []*domain.UserPreference
	var err error
	if pageKey != "" {
		result, err = h.svc.GetByPage(userID, pageKey)
	} else {
		result, err = h.svc.GetAll(userID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load preferences"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SetPreference godoc
// @Summary Set a user preference
// @Description Create or update a single preference for the authenticated user
// @Tags preferences
// @Accept json
// @Produce json
// @Param preference body setPreferenceRequest true "Preference to set"
// @Success 200 {object} preferenceResponse
// @Security BearerAuth
// @Router /preferences [put]
func (h *UserPreferenceHandler) SetPreference(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}

	var req setPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.Set(userID, req.PageKey, req.PreferenceKey, req.PreferenceValue, c.RemoteIP()); err != nil {
		if strings.Contains(err.Error(), "user_preferences_user_id_fkey") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "session user no longer exists; please sign in again"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save preference"})
		return
	}

	c.JSON(http.StatusOK, preferenceResponse(req))
}

// DeletePreference godoc
// @Summary Delete a user preference
// @Description Remove a specific preference for the authenticated user
// @Tags preferences
// @Produce json
// @Param page_key query string true "Page key"
// @Param preference_key query string true "Preference key"
// @Success 204
// @Security BearerAuth
// @Router /preferences [delete]
func (h *UserPreferenceHandler) DeletePreference(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}

	pageKey := c.Query("page_key")
	prefKey := c.Query("preference_key")
	if pageKey == "" || prefKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page_key and preference_key are required"})
		return
	}

	if err := h.svc.Delete(userID, pageKey, prefKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete preference"})
		return
	}

	c.Status(http.StatusNoContent)
}

// UITranslationHandler handles translation management endpoints.
type UITranslationHandler struct {
	svc service.UITranslationService
}

// NewUITranslationHandler creates a new UITranslationHandler.
func NewUITranslationHandler(svc service.UITranslationService) *UITranslationHandler {
	return &UITranslationHandler{svc: svc}
}

// uiTranslationPublicDTO is the public-facing representation of a UI translation.
// It intentionally includes only fields needed by i18n consumers and omits
// internal metadata such as submitter or reviewer information.
type uiTranslationPublicDTO struct {
	TranslationKey   string `json:"translation_key"`
	LanguageCode     string `json:"language_code"`
	TranslationValue string `json:"translation_value"`
}

// translationListResponse wraps a paginated list of translations.
type translationListResponse struct {
	Total   int64                     `json:"total"`
	Records []*uiTranslationPublicDTO `json:"records"`
}

// adminTranslationListResponse wraps a paginated list of full translation rows
// used by authenticated admin review tooling.
type adminTranslationListResponse struct {
	Total   int64                   `json:"total"`
	Records []*domain.UITranslation `json:"records"`
}

// submitTranslationRequest is the request body for POST /translations.
type submitTranslationRequest struct {
	TranslationKey   string `json:"translation_key" binding:"required"`
	LanguageCode     string `json:"language_code" binding:"required"`
	TranslationValue string `json:"translation_value" binding:"required"`
	Notes            string `json:"notes"`
}

// ListTranslations godoc
// @Summary List approved UI translations
// @Description Return a paginated list of approved translation strings for public read-only consumption
// @Tags translations
// @Produce json
// @Param language query string false "Filter by ISO 639-1 language code (e.g. fr, es)"
// @Param status    query string false "Public access only supports approved"
// @Param search    query string false "Search by key or value substring"
// @Param limit     query int    false "Maximum records to return (default 50)"
// @Param offset    query int    false "Offset for pagination (default 0)"
// @Success 200 {object} translationListResponse
// @Router /translations [get]
func (h *UITranslationHandler) ListTranslations(c *gin.Context) {
	h.listTranslations(c, false)
}

// ListAdminTranslations godoc
// @Summary List UI translations for admin review
// @Description Return a paginated list of translation strings, optionally filtered by language, status, or search text
// @Tags translations
// @Produce json
// @Param language query string false "Filter by ISO 639-1 language code (e.g. fr, es)"
// @Param status    query string false "Filter by status (pending, approved, rejected)"
// @Param search    query string false "Search by key or value substring"
// @Param limit     query int    false "Maximum records to return (default 50)"
// @Param offset    query int    false "Offset for pagination (default 0)"
// @Success 200 {object} translationListResponse
// @Security BearerAuth
// @Router /admin/translations [get]
func (h *UITranslationHandler) ListAdminTranslations(c *gin.Context) {
	h.listTranslations(c, true)
}

func (h *UITranslationHandler) listTranslations(c *gin.Context, allowNonApproved bool) {
	lang := c.Query("language")
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	search := c.Query("search")
	approvedStatus := string(domain.TranslationStatusApproved)

	if !allowNonApproved {
		switch status {
		case "":
			status = approvedStatus
		case approvedStatus:
			// Allowed explicitly.
		default:
			c.JSON(http.StatusForbidden, gin.H{"error": "only approved translations are publicly accessible"})
			return
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	records, total, err := h.svc.List(lang, status, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list translations"})
		return
	}

	if allowNonApproved {
		c.JSON(http.StatusOK, adminTranslationListResponse{Total: total, Records: records})
		return
	}

	publicRecords := make([]*uiTranslationPublicDTO, 0, len(records))
	for _, record := range records {
		if record == nil {
			continue
		}
		publicRecords = append(publicRecords, &uiTranslationPublicDTO{
			TranslationKey:   record.TranslationKey,
			LanguageCode:     record.LanguageCode,
			TranslationValue: record.TranslationValue,
		})
	}

	c.JSON(http.StatusOK, translationListResponse{Total: total, Records: publicRecords})
}

// SubmitTranslation godoc
// @Summary Submit a translation for review
// @Description Create or update a translation string and mark it as pending review
// @Tags translations
// @Accept json
// @Produce json
// @Param translation body submitTranslationRequest true "Translation details"
// @Success 201 {object} domain.UITranslation
// @Security BearerAuth
// @Router /translations [post]
func (h *UITranslationHandler) SubmitTranslation(c *gin.Context) {
	var req submitTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}

	t, err := h.svc.Submit(req.TranslationKey, req.LanguageCode, req.TranslationValue, req.Notes, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit translation"})
		return
	}
	c.JSON(http.StatusCreated, t)
}

// ApproveTranslation godoc
// @Summary Approve a translation
// @Description Mark a pending translation as approved (admin only)
// @Tags translations
// @Produce json
// @Param id path string true "Translation UUID"
// @Success 204
// @Security BearerAuth
// @Router /translations/{id}/approve [post]
func (h *UITranslationHandler) ApproveTranslation(c *gin.Context) {
	id := c.Param("id")
	userID := extractUserID(c)
	if err := h.svc.Approve(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve translation"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RejectTranslation godoc
// @Summary Reject a translation
// @Description Mark a pending translation as rejected (admin only)
// @Tags translations
// @Produce json
// @Param id path string true "Translation UUID"
// @Success 204
// @Security BearerAuth
// @Router /translations/{id}/reject [post]
func (h *UITranslationHandler) RejectTranslation(c *gin.Context) {
	id := c.Param("id")
	userID := extractUserID(c)
	if err := h.svc.Reject(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject translation"})
		return
	}
	c.Status(http.StatusNoContent)
}

// DeleteTranslation godoc
// @Summary Delete a translation
// @Description Remove a translation by its UUID (admin only)
// @Tags translations
// @Produce json
// @Param id path string true "Translation UUID"
// @Success 204
// @Security BearerAuth
// @Router /translations/{id} [delete]
func (h *UITranslationHandler) DeleteTranslation(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete translation"})
		return
	}
	c.Status(http.StatusNoContent)
}
