package repository

import "testing"

func TestNormalizeJSONBOrNil(t *testing.T) {
	tests := []struct {
		name  string
		input string
		nilOk bool
	}{
		{name: "empty string", input: "", nilOk: true},
		{name: "whitespace", input: "   ", nilOk: true},
		{name: "json object", input: "{}", nilOk: false},
		{name: "json payload", input: `{"field":{"before":"a","after":"b"}}`, nilOk: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeJSONBOrNil(tt.input)
			if tt.nilOk {
				if got != nil {
					t.Fatalf("expected nil, got %v", got)
				}
				return
			}

			s, ok := got.(string)
			if !ok {
				t.Fatalf("expected string result, got %T", got)
			}
			if s != tt.input {
				t.Fatalf("expected %q, got %q", tt.input, s)
			}
		})
	}
}
