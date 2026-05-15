package main

import (
	"crypto/tls"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	docs "github.com/techie2000/axiom/docs"
)

func TestBuildSwaggerDoc_UsesRequestScopedMetadataWithoutGlobalMutation(t *testing.T) {
	originalHost := docs.SwaggerInfo.Host
	originalSchemes := append([]string(nil), docs.SwaggerInfo.Schemes...)

	docBytes, err := buildSwaggerDoc("proxy.example.com", "https")
	if err != nil {
		t.Fatalf("buildSwaggerDoc() error = %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(docBytes, &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if gotHost, ok := payload["host"].(string); !ok || gotHost != "proxy.example.com" {
		t.Fatalf("swagger host = %v, want %q", payload["host"], "proxy.example.com")
	}

	schemes, ok := payload["schemes"].([]any)
	if !ok || len(schemes) != 1 || schemes[0] != "https" {
		t.Fatalf("swagger schemes = %v, want [https]", payload["schemes"])
	}

	if docs.SwaggerInfo.Host != originalHost {
		t.Fatalf("docs.SwaggerInfo.Host mutated: got %q want %q", docs.SwaggerInfo.Host, originalHost)
	}

	if len(docs.SwaggerInfo.Schemes) != len(originalSchemes) {
		t.Fatalf("docs.SwaggerInfo.Schemes length mutated: got %d want %d", len(docs.SwaggerInfo.Schemes), len(originalSchemes))
	}

	for i := range originalSchemes {
		if docs.SwaggerInfo.Schemes[i] != originalSchemes[i] {
			t.Fatalf("docs.SwaggerInfo.Schemes[%d] mutated: got %q want %q", i, docs.SwaggerInfo.Schemes[i], originalSchemes[i])
		}
	}
}

func TestResolveSwaggerHost(t *testing.T) {
	tests := []struct {
		name          string
		forwardedHost string
		requestHost   string
		want          string
	}{
		{
			name:          "uses canonical forwarded host",
			forwardedHost: "proxy.example.com:8443",
			requestHost:   "service.internal:8080",
			want:          "proxy.example.com:8443",
		},
		{
			name:          "uses first token from multi-host forwarded header",
			forwardedHost: "proxy.example.com:8443, attacker.example.com",
			requestHost:   "service.internal:8080",
			want:          "proxy.example.com:8443",
		},
		{
			name:          "falls back when forwarded host malformed",
			forwardedHost: "https://attacker.example.com/path",
			requestHost:   "service.internal:8080",
			want:          "service.internal:8080",
		},
		{
			name:          "falls back when forwarded host contains whitespace",
			forwardedHost: "bad host:8443",
			requestHost:   "service.internal:8080",
			want:          "service.internal:8080",
		},
		{
			name:          "falls back when forwarded host contains tab character",
			forwardedHost: "bad\thost:8443",
			requestHost:   "service.internal:8080",
			want:          "service.internal:8080",
		},
		{
			name:          "falls back when forwarded host contains control characters",
			forwardedHost: "badhost\nexample.com",
			requestHost:   "service.internal:8080",
			want:          "service.internal:8080",
		},
		{
			name:          "falls back when forwarded host uses invalid port",
			forwardedHost: "proxy.example.com:65536",
			requestHost:   "service.internal:8080",
			want:          "service.internal:8080",
		},
		{
			name:        "falls back to default when all hosts invalid",
			requestHost: "bad host value",
			want:        "localhost:8080",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newSwaggerTestContext(tt.requestHost)
			if tt.forwardedHost != "" {
				c.Request.Header.Set("X-Forwarded-Host", tt.forwardedHost)
			}

			if got := resolveSwaggerHost(c); got != tt.want {
				t.Fatalf("resolveSwaggerHost() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestResolveSwaggerScheme(t *testing.T) {
	tests := []struct {
		name           string
		forwardedProto string
		tlsEnabled     bool
		want           string
	}{
		{
			name:           "uses https from forwarded proto",
			forwardedProto: "https,http",
			want:           "https",
		},
		{
			name:           "uses http from forwarded proto",
			forwardedProto: "http",
			want:           "http",
		},
		{
			name:           "falls back to tls when forwarded proto invalid",
			forwardedProto: "javascript",
			tlsEnabled:     true,
			want:           "https",
		},
		{
			name: "falls back to http for non-tls request",
			want: "http",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newSwaggerTestContext("service.internal:8080")
			if tt.forwardedProto != "" {
				c.Request.Header.Set("X-Forwarded-Proto", tt.forwardedProto)
			}
			if tt.tlsEnabled {
				c.Request.TLS = &tls.ConnectionState{}
			}

			if got := resolveSwaggerScheme(c); got != tt.want {
				t.Fatalf("resolveSwaggerScheme() = %q, want %q", got, tt.want)
			}
		})
	}
}

func newSwaggerTestContext(host string) *gin.Context {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("GET", "/swagger/doc.json", nil)
	req.Host = host
	c.Request = req

	return c
}
