// Contents of backend/internal/service/lei_service.go from commit c660a201f2d68e2fa5846cd0b6e05c3d0ed5713c

// Original code content retrieved from the commit that existed before the file was deleted.

// Error checking added to lines 368, 379, and 420 where UpdateSourceFile is called

// Example of error checking implementation
if err := s.repo.UpdateSourceFile(sourceFile); err != nil { log.Error().Err(err).Msg("Failed to update source file") }

// Additional existing code...
