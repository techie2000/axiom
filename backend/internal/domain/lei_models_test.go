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
			name:    "master data sync",
			jobType: "MASTER_DATA_SYNC",
			want:    "Reference Data",
		},
		{
			name:    "level1 full",
			jobType: "LEVEL1_FULL",
			want:    "Level 1 — LEI Records",
		},
		{
			name:    "level1 delta",
			jobType: "LEVEL1_DELTA",
			want:    "Level 1 — LEI Records Delta",
		},
		{
			name:    "daily full",
			jobType: "DAILY_FULL",
			want:    "Level 1 — LEI Records",
		},
		{
			name:    "daily delta",
			jobType: "DAILY_DELTA",
			want:    "Level 1 — LEI Records Delta",
		},
		{
			name:    "level2 relationship records",
			jobType: "LEVEL2_RR",
			want:    "Level 2 — Relationship Records",
		},
		{
			name:    "level2 reporting exceptions",
			jobType: "LEVEL2_REPEX",
			want:    "Level 2 — Reporting Exceptions",
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
