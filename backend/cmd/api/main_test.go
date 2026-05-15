package main

import (
	"encoding/json"
	"testing"

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
