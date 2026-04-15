package service

import "strings"

// NormalizeProcessingJobType maps known aliases to the canonical processing
// status job types used by the scheduler/status rows.
//
// Level-1 aliases map to DAILY_* so progress updates are written to the same
// job_type consumed by /api/v1/lei/status/DAILY_FULL and DAILY_DELTA.
// Level-2 job types pass through unchanged. Unknown values return empty.
func NormalizeProcessingJobType(jobType string) string {
	normalized := strings.ToUpper(strings.TrimSpace(jobType))

	switch normalized {
	case "DAILY_FULL", "LEVEL1_FULL":
		return "DAILY_FULL"
	case "DAILY_DELTA", "LEVEL1_DELTA":
		return "DAILY_DELTA"
	case "LEVEL2_RR", "LEVEL2_REPEX":
		return normalized
	default:
		return ""
	}
}

// NormalizeProcessingFailureJobType maps known aliases to the canonical
// processing failure job types.
//
// Level-1 aliases map to LEVEL1_* so processing failures keep their
// historical category used by failure resolution paths.
func NormalizeProcessingFailureJobType(jobType string) string {
	normalized := strings.ToUpper(strings.TrimSpace(jobType))

	switch normalized {
	case "LEVEL1_FULL", "DAILY_FULL":
		return "LEVEL1_FULL"
	case "LEVEL1_DELTA", "DAILY_DELTA":
		return "LEVEL1_DELTA"
	case "LEVEL2_RR", "LEVEL2_REPEX":
		return normalized
	default:
		return ""
	}
}

func normalizeProcessingJobType(jobType string) string {
	canonical := NormalizeProcessingJobType(jobType)
	if canonical != "" {
		return canonical
	}
	return strings.TrimSpace(jobType)
}

func normalizeProcessingFailureJobType(jobType string) string {
	canonical := NormalizeProcessingFailureJobType(jobType)
	if canonical != "" {
		return canonical
	}
	return strings.TrimSpace(jobType)
}
