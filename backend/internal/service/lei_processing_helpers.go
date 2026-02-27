package service

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
)

// processingFailureCreator is the minimal interface required to persist a processing failure.
// Both LEIRepository and LEILevel2Repository satisfy this interface.
type processingFailureCreator interface {
	CreateProcessingFailure(failure *domain.LEILevel2ProcessingFailure) error
}

// persistProcessingFailure builds a LEILevel2ProcessingFailure and writes it via repo.
// Callers are responsible for normalising jobType and naturalKey before calling this function.
func persistProcessingFailure(
	repo processingFailureCreator,
	jobType string,
	sourceFileID *uuid.UUID,
	failureStage string,
	naturalKey string,
	rawRecord interface{},
	cause error,
) {
	errMessage := "unknown processing failure"
	if cause != nil {
		errMessage = cause.Error()
	}

	var rawPayload domain.JSONBString
	if rawRecord != nil {
		if rawBytes, marshalErr := json.Marshal(rawRecord); marshalErr == nil {
			rawPayload = domain.JSONBString(rawBytes)
		}
	}

	failure := &domain.LEILevel2ProcessingFailure{
		JobType:      jobType,
		SourceFileID: sourceFileID,
		FailureStage: failureStage,
		NaturalKey:   naturalKey,
		RawRecord:    rawPayload,
		ErrorMessage: errMessage,
		Resolved:     false,
	}

	if err := repo.CreateProcessingFailure(failure); err != nil {
		log.Warn().Err(err).
			Str("job_type", jobType).
			Str("failure_stage", failureStage).
			Str("natural_key", naturalKey).
			Msg("Failed to persist processing failure")
	}
}
