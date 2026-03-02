package service

import (
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *leiService) batchResolveOpenProcessingFailures(jobType string, naturalKeys []string, sourceFileID *uuid.UUID) {
	if len(naturalKeys) == 0 {
		return
	}

	normalizedKeys := make([]string, 0, len(naturalKeys))
	seen := make(map[string]struct{}, len(naturalKeys))
	for _, naturalKey := range naturalKeys {
		normalized := normalizeLEICodeValue(naturalKey)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		normalizedKeys = append(normalizedKeys, normalized)
	}

	if len(normalizedKeys) == 0 {
		return
	}

	if err := s.repo.BatchResolveOpenProcessingFailures(
		normalizeProcessingJobType(jobType),
		normalizedKeys,
		sourceFileID,
		"Resolved by subsequent successful upsert",
	); err != nil {
		log.Warn().Err(err).
			Str("job_type", jobType).
			Int("natural_key_count", len(normalizedKeys)).
			Msg("Failed to batch resolve Level 1 processing failures")
	}
}
