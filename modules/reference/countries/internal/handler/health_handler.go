package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/techie2000/axiom/modules/reference/countries/pkg/repository"
)

// HealthHandler provides HTTP endpoints for the countries service
type HealthHandler struct {
	db   *sql.DB
	repo *repository.CountryRepository
}

// NewHealthHandler creates a new HTTP handler
func NewHealthHandler(db *sql.DB, repo *repository.CountryRepository) *HealthHandler {
	return &HealthHandler{
		db:   db,
		repo: repo,
	}
}

// RegisterRoutes sets up HTTP routes
func (h *HealthHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/ready", h.Ready)
	mux.HandleFunc("/countries", h.ListCountries)
	mux.HandleFunc("/countries/", h.GetCountry)
}

// Health returns basic service health (always returns 200 if service is running)
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "axiom.reference.countries",
	})
}

// Ready checks if service can handle requests (checks DB connection)
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Check database connection
	if err := h.db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "not_ready",
			"reason": "database unavailable",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ready",
	})
}

// ListCountries returns all active countries
func (h *HealthHandler) ListCountries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	countries, err := h.repo.ListActive(r.Context())
	if err != nil {
		http.Error(w, "Failed to retrieve countries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(countries)
}

// GetCountry returns a specific country by alpha2 code
func (h *HealthHandler) GetCountry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract alpha2 code from URL path
	alpha2 := r.URL.Path[len("/countries/"):]
	if alpha2 == "" {
		http.Error(w, "Country code required", http.StatusBadRequest)
		return
	}

	country, err := h.repo.GetByAlpha2(r.Context(), alpha2)
	if err != nil {
		http.Error(w, "Country not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(country)
}
