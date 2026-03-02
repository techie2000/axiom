package service

import "strings"

// NormalizeProcessingJobType maps known Level-1 aliases to canonical names and
// keeps Level-2 job types unchanged. Unknown values return an empty string.
func NormalizeProcessingJobType(jobType string) string {
	normalized := strings.ToUpper(strings.TrimSpace(jobType))

	switch normalized {
	case "DAILY_FULL", "LEVEL1_FULL":
		return "LEVEL1_FULL"
	case "DAILY_DELTA", "LEVEL1_DELTA":
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
