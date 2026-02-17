package service

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/config"
	"github.com/techie2000/axiom/internal/domain"
)

// SchedulerService handles scheduled jobs for LEI data acquisition
type SchedulerService interface {
	Start() error
	Stop()
	RunDailyFullSync() error
	RunDailyDeltaSync() error
	RunDailyCleanup() error
}

type schedulerService struct {
	leiService LEIService
	stopChan   chan struct{}
	running    bool
	// Parsed schedule configuration
	deltaSyncInterval time.Duration
	fullSyncDay       time.Weekday
	fullSyncHour      int
	fullSyncMinute    int
	cleanupHour       int
	cleanupMinute     int
	keepFullFiles     int
	keepDeltaFiles    int
}

// NewSchedulerService creates a new scheduler service
func NewSchedulerService(leiService LEIService, cfg *config.Config) SchedulerService {
	s := &schedulerService{
		leiService: leiService,
		stopChan:   make(chan struct{}),
		running:    false,
	}

	// Parse and validate schedule configuration
	s.parseScheduleConfig(cfg)

	return s
}

// parseScheduleConfig parses and validates schedule configuration
// Falls back to defaults if values are invalid
func (s *schedulerService) parseScheduleConfig(cfg *config.Config) {
	// Parse delta sync interval (e.g., "1h", "30m")
	interval, err := time.ParseDuration(cfg.LEI.DeltaSyncInterval)
	if err != nil || interval < 1*time.Minute {
		log.Warn().
			Str("value", cfg.LEI.DeltaSyncInterval).
			Str("default", "1h").
			Msg("Invalid delta sync interval, using default")
		s.deltaSyncInterval = 1 * time.Hour
	} else {
		s.deltaSyncInterval = interval
		log.Info().
			Dur("interval", interval).
			Msg("Delta sync interval configured")
	}

	// Parse full sync day (e.g., "Sunday", "Monday")
	s.fullSyncDay = parseWeekday(cfg.LEI.FullSyncDay)
	if s.fullSyncDay < 0 {
		log.Warn().
			Str("value", cfg.LEI.FullSyncDay).
			Str("default", "Sunday").
			Msg("Invalid full sync day, using default")
		s.fullSyncDay = time.Sunday
	} else {
		log.Info().
			Str("day", s.fullSyncDay.String()).
			Msg("Full sync day configured")
	}

	// Parse full sync time (e.g., "02:00")
	hour, minute, err := parseTimeOfDay(cfg.LEI.FullSyncTime)
	if err != nil {
		log.Warn().
			Str("value", cfg.LEI.FullSyncTime).
			Str("default", "02:00").
			Err(err).
			Msg("Invalid full sync time, using default")
		s.fullSyncHour = 2
		s.fullSyncMinute = 0
	} else {
		s.fullSyncHour = hour
		s.fullSyncMinute = minute
		log.Info().
			Int("hour", hour).
			Int("minute", minute).
			Msg("Full sync time configured")
	}

	// Parse cleanup time (e.g., "03:00")
	hour, minute, err = parseTimeOfDay(cfg.LEI.CleanupTime)
	if err != nil {
		log.Warn().
			Str("value", cfg.LEI.CleanupTime).
			Str("default", "03:00").
			Err(err).
			Msg("Invalid cleanup time, using default")
		s.cleanupHour = 3
		s.cleanupMinute = 0
	} else {
		s.cleanupHour = hour
		s.cleanupMinute = minute
		log.Info().
			Int("hour", hour).
			Int("minute", minute).
			Msg("Cleanup time configured")
	}

	// Parse retention settings
	if cfg.LEI.KeepFullFiles < 1 {
		log.Warn().
			Int("value", cfg.LEI.KeepFullFiles).
			Int("default", 2).
			Msg("Invalid keep full files, using default")
		s.keepFullFiles = 2
	} else {
		s.keepFullFiles = cfg.LEI.KeepFullFiles
		log.Info().Int("count", s.keepFullFiles).Msg("Full file retention configured")
	}

	if cfg.LEI.KeepDeltaFiles < 1 {
		log.Warn().
			Int("value", cfg.LEI.KeepDeltaFiles).
			Int("default", 5).
			Msg("Invalid keep delta files, using default")
		s.keepDeltaFiles = 5
	} else {
		s.keepDeltaFiles = cfg.LEI.KeepDeltaFiles
		log.Info().Int("count", s.keepDeltaFiles).Msg("Delta file retention configured")
	}
}

// parseWeekday parses a weekday string (e.g., "Sunday", "Monday")
// Returns -1 if invalid
func parseWeekday(day string) time.Weekday {
	dayLower := strings.ToLower(strings.TrimSpace(day))
	switch dayLower {
	case "sunday", "sun":
		return time.Sunday
	case "monday", "mon":
		return time.Monday
	case "tuesday", "tue":
		return time.Tuesday
	case "wednesday", "wed":
		return time.Wednesday
	case "thursday", "thu", "thurs":
		return time.Thursday
	case "friday", "fri":
		return time.Friday
	case "saturday", "sat":
		return time.Saturday
	default:
		return -1
	}
}

// parseTimeOfDay parses a time string in HH:MM format
func parseTimeOfDay(timeStr string) (hour int, minute int, err error) {
	parts := strings.Split(strings.TrimSpace(timeStr), ":")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("invalid format, expected HH:MM")
	}

	hour, err = strconv.Atoi(parts[0])
	if err != nil || hour < 0 || hour > 23 {
		return 0, 0, fmt.Errorf("invalid hour: %s", parts[0])
	}

	minute, err = strconv.Atoi(parts[1])
	if err != nil || minute < 0 || minute > 59 {
		return 0, 0, fmt.Errorf("invalid minute: %s", parts[1])
	}

	return hour, minute, nil
}

// Start begins the scheduler
func (s *schedulerService) Start() error {
	if s.running {
		log.Warn().Msg("Scheduler already running")
		return nil
	}

	s.running = true
	log.Info().Msg("Starting LEI scheduler service")

	// CRITICAL: Reset any stuck RUNNING statuses from previous crashes/restarts
	s.cleanupStuckJobStatuses()

	// CRITICAL: Initialize next_run_at for jobs that don't have it set
	s.initializeNextRunTimes()

	// Check for initial data load on startup (one-time check)
	count, err := s.leiService.CountLEIRecords()
	if err != nil {
		log.Error().Err(err).Msg("Failed to count LEI records during startup")
	} else if count == 0 {
		log.Info().Msg("Database is empty, triggering initial full sync")
		go func() {
			if err := s.RunDailyFullSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run initial full sync")
			}
		}()
	} else {
		log.Info().Int64("existing_records", count).Msg("Database has existing records, waiting for scheduled full sync")
	}

	// DELTA SYNC DISABLED - Using FULL sync only strategy
	// Delta files cause issues and don't provide enough benefit for daily operations
	// go s.dailyDeltaSyncLoop()

	// Start goroutine for daily full sync (runs every day at configured time)
	go s.dailyFullSyncLoop()

	// Start goroutine for daily cleanup (runs daily at 3 AM)
	go s.dailyCleanupLoop()

	return nil
}

// Stop stops the scheduler
func (s *schedulerService) Stop() {
	if !s.running {
		return
	}

	log.Info().Msg("Stopping LEI scheduler service")
	s.running = false
	close(s.stopChan)
}

// cleanupStuckJobStatuses resets any jobs stuck in RUNNING status
// This handles crash recovery and ensures clean startup
func (s *schedulerService) cleanupStuckJobStatuses() {
	log.Info().Msg("Checking for stuck job statuses from previous sessions")

	// Check DAILY_FULL status
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err == nil && fullStatus.Status == "RUNNING" {
		log.Warn().
			Str("job_type", "DAILY_FULL").
			Time("last_run", *fullStatus.LastRunAt).
			Msg("Resetting stuck RUNNING status to IDLE (process was interrupted)")
		fullStatus.Status = "IDLE"
		fullStatus.CurrentSourceFileID = nil
		fullStatus.ErrorMessage = "Previous run was interrupted"
		if err := s.leiService.UpdateProcessingStatus(fullStatus); err != nil {
			log.Error().Err(err).Msg("Failed to reset DAILY_FULL status")
		}
	}

	// Check DAILY_DELTA status
	deltaStatus, err := s.leiService.GetProcessingStatus("DAILY_DELTA")
	if err == nil && deltaStatus.Status == "RUNNING" {
		log.Warn().
			Str("job_type", "DAILY_DELTA").
			Time("last_run", *deltaStatus.LastRunAt).
			Msg("Resetting stuck RUNNING status to IDLE (process was interrupted)")
		deltaStatus.Status = "IDLE"
		deltaStatus.CurrentSourceFileID = nil
		deltaStatus.ErrorMessage = "Previous run was interrupted"
		if err := s.leiService.UpdateProcessingStatus(deltaStatus); err != nil {
			log.Error().Err(err).Msg("Failed to reset DAILY_DELTA status")
		}
	}

	log.Info().Msg("Stuck job status cleanup completed")
}

// initializeNextRunTimes ensures all jobs have next_run_at set
// This handles cases where jobs completed but next_run_at wasn't saved
func (s *schedulerService) initializeNextRunTimes() {
	log.Info().Msg("Initializing next_run_at for jobs if missing")

	// Initialize DAILY_FULL
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err == nil && fullStatus.NextRunAt == nil {
		log.Info().
			Str("job_type", "DAILY_FULL").
			Str("status", fullStatus.Status).
			Msg("Setting next_run_at for DAILY_FULL job")
		fullStatus.NextRunAt = calculateNextWeeklyRun()
		if err := s.leiService.UpdateProcessingStatus(fullStatus); err != nil {
			log.Error().Err(err).Msg("Failed to update DAILY_FULL next_run_at")
		} else {
			log.Info().
				Time("next_run", *fullStatus.NextRunAt).
				Msg("DAILY_FULL next_run_at initialized")
		}
	}

	// Initialize DAILY_DELTA (runs hourly but named DAILY_DELTA)
	deltaStatus, err := s.leiService.GetProcessingStatus("DAILY_DELTA")
	if err == nil && deltaStatus.NextRunAt == nil {
		log.Info().
			Str("job_type", "DAILY_DELTA").
			Str("status", deltaStatus.Status).
			Msg("Setting next_run_at for DAILY_DELTA job")
		deltaStatus.NextRunAt = calculateNextRun(s.deltaSyncInterval)
		if err := s.leiService.UpdateProcessingStatus(deltaStatus); err != nil {
			log.Error().Err(err).Msg("Failed to update DAILY_DELTA next_run_at")
		} else {
			log.Info().
				Time("next_run", *deltaStatus.NextRunAt).
				Msg("DAILY_DELTA next_run_at initialized")
		}
	} else if err != nil {
		// DAILY_DELTA job doesn't exist - create it
		log.Info().Msg("DAILY_DELTA job status doesn't exist, creating...")
		now := time.Now()
		nextRun := calculateNextRun(s.deltaSyncInterval)
		newStatus := &domain.FileProcessingStatus{
			JobType:   "DAILY_DELTA",
			Status:    "IDLE",
			NextRunAt: nextRun,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.leiService.UpdateProcessingStatus(newStatus); err != nil {
			log.Error().Err(err).Msg("Failed to create DAILY_DELTA job status")
		} else {
			log.Info().
				Time("next_run", *nextRun).
				Msg("DAILY_DELTA job status created")
		}
	}

	log.Info().Msg("Next_run_at initialization completed")
}

// dailyDeltaSyncLoop runs delta sync at configured interval
func (s *schedulerService) dailyDeltaSyncLoop() {
	ticker := time.NewTicker(s.deltaSyncInterval)
	defer ticker.Stop()

	// First, check for FAILED files that should be retried
	failedFiles, err := s.leiService.FindRetryableFailedFiles()
	if err != nil {
		log.Error().Err(err).Msg("Failed to check for retryable failed files")
	} else if len(failedFiles) > 0 {
		log.Info().
			Int("failed_files", len(failedFiles)).
			Msg("Found retryable failed files, resetting to PENDING for retry")
		for i := range failedFiles {
			file := failedFiles[i]
			fileID := file.ID
			log.Info().
				Str("file_id", fileID.String()).
				Str("file_name", file.FileName).
				Str("failure_category", file.FailureCategory).
				Int("retry_count", file.RetryCount).
				Int("max_retries", file.MaxRetries).
				Msg("Resetting failed file for retry")
			if err := s.leiService.ResetFailedFileForRetry(fileID); err != nil {
				log.Error().Err(err).Str("file_id", fileID.String()).Msg("Failed to reset file for retry")
			}
		}
	}

	// Check for incomplete files (PENDING or IN_PROGRESS)
	pendingFiles, err := s.leiService.FindPendingSourceFiles()
	if err != nil {
		log.Error().Err(err).Msg("Failed to check for pending source files")
	} else if len(pendingFiles) > 0 {
		// Abort old PENDING files (over 24 hours old) to prevent accumulation
		now := time.Now()
		for i := range pendingFiles {
			oldFile := pendingFiles[i]
			oldFileID := oldFile.ID
			// If file is PENDING and created more than 24 hours ago, mark as FAILED
			if oldFile.ProcessingStatus == "PENDING" && now.Sub(oldFile.CreatedAt) > 24*time.Hour {
				log.Warn().
					Str("file_id", oldFileID.String()).
					Str("file_name", oldFile.FileName).
					Str("age", now.Sub(oldFile.CreatedAt).String()).
					Msg("Marking old PENDING file as TIMED_OUT")
				oldFile.ProcessingStatus = "FAILED"
				oldFile.ProcessingError = "File pending for more than 24 hours - timed out"
				oldFile.FailureCategory = "TIMEOUT"
				s.leiService.UpdateSourceFile(oldFile)
			}
		}

		// Re-fetch active pending files after cleanup
		pendingFiles, err = s.leiService.FindPendingSourceFiles()
		if err != nil {
			log.Error().Err(err).Msg("Failed to re-fetch pending source files")
		} else if len(pendingFiles) > 0 {
			log.Info().Int("pending_files", len(pendingFiles)).Msg("Found incomplete source files, resuming processing")

			// Process pending files
			for i := range pendingFiles {
				file := pendingFiles[i]
				fileID := file.ID // Capture ID to avoid loop variable reuse bug
				// Determine job type from file type
				jobType := "DAILY_FULL"
				if file.FileType == "DELTA" {
					jobType = "DAILY_DELTA"
				}
				// Update job status to RUNNING when resuming file processing
				if jobStatus, err := s.leiService.GetProcessingStatus(jobType); err == nil {
					jobStatus.Status = "RUNNING"
					jobStatus.ErrorMessage = "" // Clear any previous error
					now := time.Now()
					jobStatus.LastRunAt = &now
					jobStatus.CurrentSourceFileID = &fileID
					s.leiService.UpdateProcessingStatus(jobStatus)
					log.Info().Str("job_type", jobType).Str("previous_status", jobStatus.Status).Msg("Updated job status to RUNNING for file resume")
				}

				// FIX: Use checkpoint resume regardless of status (PENDING or IN_PROGRESS)
				resumeLEI := ""
				if file.LastProcessedLEI != "" {
					resumeLEI = file.LastProcessedLEI
					log.Info().
						Str("file_id", fileID.String()).
						Str("file_name", file.FileName).
						Str("resume_from", resumeLEI).
						Int("processed", file.ProcessedRecords).
						Int("total", file.TotalRecords).
						Msg("Resuming from checkpoint")
				} else {
					log.Info().
						Str("file_id", fileID.String()).
						Str("file_name", file.FileName).
						Msg("Processing pending file from beginning")
				}

				if err := s.leiService.ProcessSourceFileWithResume(fileID, resumeLEI); err != nil {
					log.Error().Err(err).Str("file_id", fileID.String()).Msg("Failed to process pending file")
					// Update job status to FAILED
					if jobStatus, getErr := s.leiService.GetProcessingStatus(jobType); getErr == nil {
						jobStatus.Status = "FAILED"
						jobStatus.ErrorMessage = err.Error()
						s.leiService.UpdateProcessingStatus(jobStatus)
					}
				} else {
					// Update job status to COMPLETED on success
					if jobStatus, getErr := s.leiService.GetProcessingStatus(jobType); getErr == nil {
						jobStatus.Status = "COMPLETED"
						now := time.Now()
						jobStatus.LastSuccessAt = &now
						jobStatus.ErrorMessage = ""
						jobStatus.CurrentSourceFileID = nil
						s.leiService.UpdateProcessingStatus(jobStatus)
						log.Info().Str("job_type", jobType).Msg("Updated job status to COMPLETED after retry success")
					}
				}
			}
		}
	} else {
		// No incomplete files - check if database is empty for initial run decision
		count, err := s.leiService.CountLEIRecords()
		if err != nil {
			log.Error().Err(err).Msg("Failed to count LEI records")
		} else if count == 0 {
			log.Info().Msg("Database is empty, running initial full sync")
			if err := s.RunDailyFullSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run initial full sync")
			}
		} else {
			log.Info().Int64("existing_records", count).Msg("Database has existing records - delta sync disabled, waiting for scheduled full sync")
		}
		return // Exit function early since delta sync loop is disabled
	}

	for {
		select {
		case <-ticker.C:
			if err := s.RunDailyDeltaSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run scheduled delta sync")
			}
		case <-s.stopChan:
			log.Info().Msg("Stopping delta sync loop")
			return
		}
	}
}

// dailyFullSyncLoop runs full sync every day at configured time (default 2:00 AM)
func (s *schedulerService) dailyFullSyncLoop() {
	for {
		// Calculate next run at configured time today or tomorrow
		now := time.Now()
		nextRun := time.Date(now.Year(), now.Month(), now.Day(), s.fullSyncHour, s.fullSyncMinute, 0, 0, now.Location())

		// If we've already passed today's scheduled time, schedule for tomorrow
		if nextRun.Before(now) || nextRun.Equal(now) {
			nextRun = nextRun.AddDate(0, 0, 1)
		}

		duration := nextRun.Sub(now)
		log.Info().
			Time("next_run", nextRun).
			Dur("wait_duration", duration).
			Msg("Scheduled next full sync")

		select {
		case <-time.After(duration):
			if err := s.RunDailyFullSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run scheduled full sync")
			}
		case <-s.stopChan:
			log.Info().Msg("Stopping full sync loop")
			return
		}
	}
}

// RunDailyDeltaSync downloads and processes delta file
func (s *schedulerService) RunDailyDeltaSync() error {
	log.Info().Msg("Starting daily delta sync")

	// Update processing status
	status, err := s.leiService.GetProcessingStatus("DAILY_DELTA")
	if err != nil {
		log.Error().Err(err).Msg("Failed to get processing status")
		// Create new status if not found
		status = &domain.FileProcessingStatus{
			JobType: "DAILY_DELTA",
			Status:  "IDLE",
		}
	}

	// Check if already running
	if status.Status == "RUNNING" {
		log.Warn().Msg("Delta sync already running, skipping")
		return nil
	}

	// Check if full sync is running (prevent concurrent execution)
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err == nil && fullStatus.Status == "RUNNING" {
		log.Warn().Msg("Full sync is running, skipping delta sync to prevent race condition")
		return nil
	}

	// Update status
	status.Status = "RUNNING"
	now := time.Now()
	status.LastRunAt = &now
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	// Download delta file
	sourceFile, err := s.leiService.DownloadDeltaFile()
	if err != nil {
		// Check if this is a duplicate file (already processed)
		if strings.Contains(err.Error(), "duplicate file already processed") {
			// This is success - no new data to process
			log.Info().Msg("No new delta file available (duplicate hash detected)")
			status.Status = "COMPLETED"
			status.LastSuccessAt = &now
			status.NextRunAt = calculateNextRun(s.deltaSyncInterval)
			status.ErrorMessage = ""
			s.leiService.UpdateProcessingStatus(status)
			return nil
		}
		// Real error
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		s.leiService.UpdateProcessingStatus(status)
		return err
	}

	// Update status with current file
	status.CurrentSourceFileID = &sourceFile.ID
	s.leiService.UpdateProcessingStatus(status)

	// Process file
	if err := s.leiService.ProcessSourceFile(sourceFile.ID); err != nil {
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		s.leiService.UpdateProcessingStatus(status)
		return err
	}

	// Update status
	status.Status = "COMPLETED"
	status.LastSuccessAt = &now
	status.NextRunAt = calculateNextRun(s.deltaSyncInterval)
	status.ErrorMessage = ""
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	log.Info().Msg("Daily delta sync completed successfully")
	return nil
}

// RunDailyFullSync downloads and processes full file
func (s *schedulerService) RunDailyFullSync() error {
	log.Info().Msg("Starting daily full sync")

	// Update processing status
	status, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		log.Error().Err(err).Msg("Failed to get processing status")
		// Create new status if not found
		status = &domain.FileProcessingStatus{
			JobType: "DAILY_FULL",
			Status:  "IDLE",
		}
	}

	// Check if already running
	if status.Status == "RUNNING" {
		log.Warn().Msg("Full sync already running, skipping")
		return nil
	}

	// Check if delta sync is running (prevent concurrent execution)
	deltaStatus, err := s.leiService.GetProcessingStatus("DAILY_DELTA")
	if err == nil && deltaStatus.Status == "RUNNING" {
		log.Warn().Msg("Delta sync is running, skipping full sync to prevent race condition")
		return nil
	}

	// Update status
	status.Status = "RUNNING"
	now := time.Now()
	status.LastRunAt = &now
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	// Download full file
	sourceFile, err := s.leiService.DownloadFullFile()
	if err != nil {
		// Check if this is a duplicate file (already processed)
		if strings.Contains(err.Error(), "duplicate file already processed") {
			// This is success - no new data to process
			log.Info().Msg("No new full file available (duplicate hash detected)")
			status.Status = "COMPLETED"
			status.LastSuccessAt = &now
			status.NextRunAt = calculateNextWeeklyRun()
			status.ErrorMessage = ""
			s.leiService.UpdateProcessingStatus(status)
			return nil
		}
		// Real error
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		s.leiService.UpdateProcessingStatus(status)
		return err
	}

	// Update status with current file
	status.CurrentSourceFileID = &sourceFile.ID
	s.leiService.UpdateProcessingStatus(status)

	// Process file (can resume if interrupted)
	var resumeLEI string
	if sourceFile.LastProcessedLEI != "" {
		resumeLEI = sourceFile.LastProcessedLEI
		log.Info().Str("resume_from", resumeLEI).Msg("Resuming file processing")
	}

	if err := s.leiService.ProcessSourceFileWithResume(sourceFile.ID, resumeLEI); err != nil {
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		s.leiService.UpdateProcessingStatus(status)
		return err
	}

	// Update status
	status.Status = "COMPLETED"
	status.LastSuccessAt = &now
	status.NextRunAt = calculateNextWeeklyRun()
	status.ErrorMessage = ""
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	log.Info().Msg("Daily full sync completed successfully")
	return nil
}

// calculateNextRun calculates the next run time based on interval
func calculateNextRun(interval time.Duration) *time.Time {
	next := time.Now().Add(interval)
	return &next
}

// calculateNextWeeklyRun calculates next Sunday at 2 AM
func calculateNextWeeklyRun() *time.Time {
	now := time.Now()
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), 2, 0, 0, 0, now.Location())

	daysUntilSunday := (7 - int(now.Weekday())) % 7
	if daysUntilSunday == 0 && now.Hour() >= 2 {
		daysUntilSunday = 7
	}
	nextRun = nextRun.AddDate(0, 0, daysUntilSunday)

	if nextRun.Before(now) {
		nextRun = nextRun.AddDate(0, 0, 7)
	}

	return &nextRun
}

// dailyCleanupLoop runs cleanup at configured time daily
func (s *schedulerService) dailyCleanupLoop() {
	for {
		// Calculate next run at configured time
		now := time.Now()
		nextRun := time.Date(now.Year(), now.Month(), now.Day(), s.cleanupHour, s.cleanupMinute, 0, 0, now.Location())

		// If we've passed the configured time today, schedule for tomorrow
		if nextRun.Before(now) {
			nextRun = nextRun.AddDate(0, 0, 1)
		}

		duration := nextRun.Sub(now)
		log.Info().
			Time("next_run", nextRun).
			Dur("wait_duration", duration).
			Msg("Scheduled next cleanup")

		select {
		case <-time.After(duration):
			if err := s.RunDailyCleanup(); err != nil {
				log.Error().Err(err).Msg("Failed to run scheduled cleanup")
			}
		case <-s.stopChan:
			log.Info().Msg("Stopping cleanup loop")
			return
		}
	}
}

// RunDailyCleanup removes old LEI files to free disk space
func (s *schedulerService) RunDailyCleanup() error {
	log.Info().Msg("Starting daily file cleanup")

	if err := s.leiService.CleanupOldFiles(s.keepFullFiles, s.keepDeltaFiles); err != nil {
		log.Error().Err(err).Msg("Failed to cleanup old files")
		return err
	}

	log.Info().Msg("Daily cleanup completed successfully")
	return nil
}
