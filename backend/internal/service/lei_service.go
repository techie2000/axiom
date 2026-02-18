// Updated version of the UpdateSourceFile calls with error checking

// Example for line 352
if err := s.repo.UpdateSourceFile(sourceFile); err != nil {
    log.Error().Err(err).Msg("Failed to update source file")
}

// Repeat for other lines mentioned

// For each of the UpdateProcessingStatus calls
if err := s.leiService.UpdateProcessingStatus(status); err != nil {
    log.Error().Err(err).Msg("Failed to update processing status")
}

// Repeat for all relevant calls
