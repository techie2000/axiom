package domain

import "testing"

func TestJobTypeDisplayName(t *testing.T) {
	tests := []struct {
		name    string
		jobType string
		want    string
	}{
		{
			name:    "gleif reference sync",
			jobType: "GLEIF_REFERENCE_SYNC",
			want:    "GLEIF Reference Code Lists",
		},
		{
			name:    "unknown job type falls back to raw value",
			jobType: "CUSTOM_JOB",
			want:    "CUSTOM_JOB",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := JobTypeDisplayName(tt.jobType)
			if got != tt.want {
				t.Fatalf("JobTypeDisplayName(%q) = %q, want %q", tt.jobType, got, tt.want)
			}
		})
	}
}
