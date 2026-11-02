package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/techie2000/axiom/internal/config"
	"github.com/techie2000/axiom/internal/handler"
)

// newTestRouter builds the real router with empty handlers. Route registration only binds handler
// method values, so no service or database is needed; this exercises the startup path that Gin
// panics on when routes conflict.
func newTestRouter(t *testing.T) http.Handler {
	t.Helper()

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("setupRouter() panicked during route registration: %v", r)
		}
	}()

	return setupRouter(&config.Config{}, &handler.Handlers{})
}

func TestSetupRouter_RegistersRoutesWithoutPanic(t *testing.T) {
	if newTestRouter(t) == nil {
		t.Fatal("setupRouter() returned nil")
	}
}

func TestSetupRouter_SwaggerRoutes(t *testing.T) {
	router := newTestRouter(t)

	t.Run("doc.json is rendered with request-scoped metadata", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/swagger/doc.json", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("GET /swagger/doc.json status = %d, want %d", rec.Code, http.StatusOK)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Fatalf("GET /swagger/doc.json Content-Type = %q, want application/json", ct)
		}
	})

	t.Run("swagger UI index is served", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/swagger/index.html", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("GET /swagger/index.html status = %d, want %d", rec.Code, http.StatusOK)
		}
	})
}
