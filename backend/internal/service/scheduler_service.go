package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/config"
	"github.com/techie2000/axiom/internal/domain"
)

// ErrJobRunning is returned by Trigger* methods when the requested job cannot be started
// because it or one of its dependencies is currently running.
var ErrJobRunning = errors.New("job running")

// SchedulerService handles scheduled jobs for LEI data acquisition and master data sync
type SchedulerService interface {
	Start() error
	Stop()
	RunDailyFullSync() error
	RunDailyDeltaSync() error
	RunDailyCleanup() error
	RunDailyMasterDataSync() error
	RunLevel2Sync() error
	RunLevel2RRSync() error
	RunLevel2REPEXSync() error

	// Trigger* methods are the HTTP-handler entry-points. Each one:
	//  1. Acquires triggerMu so concurrent API calls are serialised.
	//  2. Validates that neither the job itself nor any dependency is RUNNING.
	//  3. Spawns the async goroutine only when it is safe to do so.
	//  4. Returns ErrJobRunning (409) or a plain error (500) when the job cannot start.
	TriggerFullSync() error
	TriggerDeltaSync() error
	TriggerMasterDataSync() error
	TriggerLevel2Sync() error
	TriggerLevel2RRSync() error
	TriggerLevel2REPEXSync() error
}

type schedulerService struct {
	leiService        LEIService
	leiLevel2Service  LEILevel2Service
	masterDataService MasterDataService
	stopChan          chan struct{}
	running           bool
	// triggerMu serialises concurrent manual-trigger API calls so that the
	// status check and goroutine spawn happen atomically from the caller's
	// perspective, eliminating the TOCTOU race between handler validation
	// and the scheduler-service safety net.
	triggerMu sync.Mutex
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
func NewSchedulerService(leiService LEIService, leiLevel2Service LEILevel2Service, masterDataService MasterDataService, cfg *config.Config) SchedulerService {
	s := &schedulerService{
		leiService:        leiService,
		leiLevel2Service:  leiLevel2Service,
		masterDataService: masterDataService,
		stopChan:          make(chan struct{}),
		running:           false,
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

	// Parse cleanup time (e.g., "00:00" for midnight)
	hour, minute, err = parseTimeOfDay(cfg.LEI.CleanupTime)
	if err != nil {
		log.Warn().
			Str("value", cfg.LEI.CleanupTime).
			Str("default", "00:00").
			Err(err).
			Msg("Invalid cleanup time, using default")
		s.cleanupHour = 0 // Midnight - runs BEFORE all syncs
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

	// Auto-resume interrupted full sync files from previous crashes/restarts
	resumed, err := s.resumeInterruptedFullSyncOnStartup()
	if err != nil {
		log.Error().Err(err).Msg("Failed to check interrupted full sync files")
	}

	// Check for initial data load on startup (one-time check)
	if !resumed {
		// Level 1 is not mid-file. Check if Level 2 jobs need recovery before
		// deciding whether to trigger a fresh Level 1 load.
		if !s.resumeFailedLevel2OnStartup() {
			count, err := s.leiService.CountLEIRecords()
			if err != nil {
				log.Error().Err(err).Msg("Failed to count LEI records during startup")
			} else if count == 0 {
				log.Info().Msg("Database is empty, triggering initial full sync")
				go func() {
					// Ensure reference data is current before downloading LEI records.
					// main.go already ran LoadAllMasterData unconditionally on startup,
					// so RunDailyMasterDataSync here primarily updates file_processing_status
					// to make the pipeline visible in the UI. A sync error is non-fatal
					// because the master data is already in the database.
					if err := s.RunDailyMasterDataSync(); err != nil {
						log.Error().Err(err).Msg("Initial master data sync check failed; continuing with LEI sync")
					}
					if err := s.RunDailyFullSync(); err != nil {
						log.Error().Err(err).Msg("Failed to run initial full sync")
						return
					}
					// Level 2 sync is a dependent job: run it after Level 1 is complete.
					log.Info().Msg("Initial Level 1 sync succeeded, triggering initial Level 2 sync")
					if err := s.RunLevel2Sync(); err != nil {
						log.Error().Err(err).Msg("Failed to run initial Level 2 sync")
					}
				}()
			} else {
				fullStatus, statusErr := s.leiService.GetProcessingStatus("DAILY_FULL")
				now := time.Now()
				if statusErr == nil && fullStatus.Status != "RUNNING" && fullStatus.NextRunAt != nil &&
					(fullStatus.NextRunAt.Before(now) || fullStatus.NextRunAt.Equal(now)) {
					log.Info().
						Int64("existing_records", count).
						Time("overdue_next_run", *fullStatus.NextRunAt).
						Msg("Database has existing records and DAILY_FULL is overdue, triggering catch-up full sync now")

					go func() {
						if err := s.RunDailyMasterDataSync(); err != nil {
							log.Error().Err(err).Msg("Catch-up master data sync check failed; continuing with LEI sync")
						}
						if err := s.RunDailyFullSync(); err != nil {
							log.Error().Err(err).Msg("Failed to run catch-up full sync")
							return
						}
						log.Info().Msg("Catch-up Level 1 sync succeeded, triggering dependent Level 2 sync")
						if err := s.RunLevel2Sync(); err != nil {
							log.Error().Err(err).Msg("Failed to run Level 2 sync after catch-up full sync")
						}
					}()
				} else {
					log.Info().Int64("existing_records", count).Msg("Database has existing records, waiting for scheduled full sync")
				}
			}
		}
	}

	// DELTA SYNC DISABLED - Using FULL sync only strategy
	// Delta files cause issues and don't provide enough benefit for daily operations
	// go s.dailyDeltaSyncLoop()

	// Start goroutine for daily master data sync (runs daily at 1 AM)
	go s.dailyMasterDataSyncLoop()

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

	jobTypes := []string{"MASTER_DATA_SYNC", "DAILY_FULL", "DAILY_DELTA", "LEVEL2_RR", "LEVEL2_REPEX"}
	for _, jobType := range jobTypes {
		st, err := s.leiService.GetProcessingStatus(jobType)
		if err == nil && st.Status == "RUNNING" {
			log.Warn().
				Str("job_type", jobType).
				Msg("Resetting stuck RUNNING status to FAILED (process was interrupted)")
			st.Status = "FAILED"
			st.CurrentSourceFileID = nil
			st.ErrorMessage = "Previous run was interrupted by process restart"
			if err := s.leiService.UpdateProcessingStatus(st); err != nil {
				log.Error().Err(err).Str("job_type", jobType).Msg("Failed to reset stuck job status")
			}
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
		fullStatus.NextRunAt = s.calculateNextDailyFullRun()
		if err := s.leiService.UpdateProcessingStatus(fullStatus); err != nil {
			log.Error().Err(err).Msg("Failed to update DAILY_FULL next_run_at")
		}
		log.Info().
			Time("next_run", *fullStatus.NextRunAt).
			Msg("DAILY_FULL next_run_at initialized")
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
		}
		log.Info().
			Time("next_run", *deltaStatus.NextRunAt).
			Msg("DAILY_DELTA next_run_at initialized")
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
		}
		log.Info().
			Time("next_run", *nextRun).
			Msg("DAILY_DELTA job status created")
	}

	// Ensure MASTER_DATA_SYNC row exists (root job — no parent dependency).
	// Migration 000027 seeds this row, but this guard handles environments where
	// migrations have not yet been applied (e.g. local dev).
	if mdStatus, mdErr := s.leiService.GetProcessingStatus("MASTER_DATA_SYNC"); mdErr != nil {
		now := time.Now()
		nextRun := s.calculateNextMasterDataRun()
		newMD := &domain.FileProcessingStatus{
			JobType:   "MASTER_DATA_SYNC",
			Status:    "IDLE",
			NextRunAt: nextRun,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if createErr := s.leiService.UpdateProcessingStatus(newMD); createErr != nil {
			log.Error().Err(createErr).Msg("Failed to create MASTER_DATA_SYNC job status row")
		} else {
			log.Info().Msg("MASTER_DATA_SYNC job status row created")
		}
	} else if mdStatus.NextRunAt == nil {
		mdStatus.NextRunAt = s.calculateNextMasterDataRun()
		if updateErr := s.leiService.UpdateProcessingStatus(mdStatus); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to initialize MASTER_DATA_SYNC next_run_at")
		}
	}

	// Ensure LEVEL2_RR and LEVEL2_REPEX rows exist with the correct dependency metadata.
	// Migration 000026 seeds these rows, but this guard handles cases where the migration
	// has not yet been applied (e.g. local dev without running migrations first).
	type level2Def struct {
		jobType          string
		dependsOnJobType string
	}
	for _, def := range []level2Def{
		{"LEVEL2_RR", "DAILY_FULL"},
		{"LEVEL2_REPEX", "LEVEL2_RR"},
	} {
		st, getErr := s.leiService.GetProcessingStatus(def.jobType)
		if getErr != nil {
			// Row doesn't exist — create it with the dependency metadata.
			now := time.Now()
			newSt := &domain.FileProcessingStatus{
				JobType:          def.jobType,
				Status:           "IDLE",
				DependsOnJobType: def.dependsOnJobType,
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			if createErr := s.leiService.UpdateProcessingStatus(newSt); createErr != nil {
				log.Error().Err(createErr).Str("job_type", def.jobType).Msg("Failed to create Level 2 job status row")
			} else {
				log.Info().Str("job_type", def.jobType).Str("depends_on", def.dependsOnJobType).Msg("Level 2 job status row created")
			}
		} else if st.DependsOnJobType == "" {
			// Row exists but dependency column was not yet set (pre-migration 000026).
			st.DependsOnJobType = def.dependsOnJobType
			if updateErr := s.leiService.UpdateProcessingStatus(st); updateErr != nil {
				log.Error().Err(updateErr).Str("job_type", def.jobType).Msg("Failed to set depends_on_job_type on Level 2 job row")
			}
		}
	}

	log.Info().Msg("Next_run_at initialization completed")
}

// resumeFailedLevel2OnStartup checks whether Level 2 jobs were left in FAILED status from a
// previous run in which Level 1 (DAILY_FULL) had already completed successfully.
// If so it resumes Level 2 from the earliest failed step rather than re-running Level 1.
// Returns true if a recovery goroutine was launched so the caller can skip the initial-load check.
func (s *schedulerService) resumeFailedLevel2OnStartup() bool {
	// Level 1 must have completed at least once to consider Level 2 recovery.
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil || fullStatus.LastSuccessAt == nil {
		return false
	}

	rrStatus, rrErr := s.leiService.GetProcessingStatus("LEVEL2_RR")
	repexStatus, repexErr := s.leiService.GetProcessingStatus("LEVEL2_REPEX")

	rrFailed := rrErr == nil && rrStatus.Status == "FAILED"
	repexFailed := repexErr == nil && repexStatus.Status == "FAILED"
	rrSucceeded := rrErr == nil && rrStatus.Status == "IDLE" && rrStatus.LastSuccessAt != nil

	switch {
	case rrFailed:
		// RR failed — re-run both RR then REPEX.
		log.Info().Msg("LEVEL2_RR is FAILED and DAILY_FULL succeeded — resuming Level 2 sync from RR step")
		go func() {
			if err := s.runLevel2SyncFrom("LEVEL2_RR"); err != nil {
				log.Error().Err(err).Msg("Failed to resume Level 2 sync from RR on startup")
			}
		}()
		return true

	case repexFailed && rrSucceeded:
		// RR succeeded but REPEX failed — skip RR and resume from REPEX only.
		log.Info().Msg("LEVEL2_REPEX is FAILED and LEVEL2_RR succeeded — resuming Level 2 sync from REPEX step")
		go func() {
			if err := s.runLevel2SyncFrom("LEVEL2_REPEX"); err != nil {
				log.Error().Err(err).Msg("Failed to resume Level 2 sync from REPEX on startup")
			}
		}()
		return true
	}

	return false
}

func (s *schedulerService) resumeInterruptedFullSyncOnStartup() (bool, error) {
	pendingFiles, err := s.leiService.FindPendingSourceFiles()
	if err != nil {
		return false, fmt.Errorf("failed to find pending source files: %w", err)
	}

	var interruptedFile *domain.SourceFile
	for i := range pendingFiles {
		file := pendingFiles[i]
		if file.FileType != "FULL" {
			continue
		}

		isInterrupted := file.ProcessingStatus == "IN_PROGRESS" || file.ProcessedRecords > 0 || leiCodeValue(file.LastProcessedLEI) != ""
		if !isInterrupted {
			continue
		}

		if interruptedFile == nil || file.UpdatedAt.After(interruptedFile.UpdatedAt) {
			interruptedFile = file
		}
	}

	if interruptedFile == nil {
		return false, nil
	}

	fileID := interruptedFile.ID
	fileAvailable, err := s.leiService.SourceFileExists(fileID)
	if err != nil {
		return false, fmt.Errorf("failed to verify interrupted source file availability: %w", err)
	}

	if !fileAvailable {
		log.Warn().
			Str("source_file_id", fileID.String()).
			Str("file_name", interruptedFile.FileName).
			Msg("Interrupted full-sync source file is missing; marking file failed and triggering fresh full sync")

		interruptedFile.ProcessingStatus = "FAILED"
		interruptedFile.ProcessingError = "Source file missing on startup; resumed processing skipped"
		interruptedFile.FailureCategory = "FILE_MISSING"
		if updateErr := s.leiService.UpdateSourceFile(interruptedFile); updateErr != nil {
			log.Error().Err(updateErr).Str("source_file_id", fileID.String()).Msg("Failed to mark missing interrupted file as FAILED")
		}

		status, statusErr := s.leiService.GetProcessingStatus("DAILY_FULL")
		if statusErr != nil {
			status = &domain.FileProcessingStatus{JobType: "DAILY_FULL", Status: "IDLE"}
		}
		status.Status = "IDLE"
		status.ErrorMessage = "Auto-resume skipped: source file missing"
		status.CurrentSourceFileID = nil
		status.NextRunAt = s.calculateNextDailyFullRun()
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to reset DAILY_FULL status after missing interrupted file")
		}

		go func() {
			if freshErr := s.RunDailyFullSync(); freshErr != nil {
				log.Error().Err(freshErr).Msg("Fresh full sync failed after missing interrupted source file")
			}
		}()

		return true, nil
	}

	status, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		status = &domain.FileProcessingStatus{
			JobType: "DAILY_FULL",
			Status:  "IDLE",
		}
	}

	now := time.Now()
	status.Status = "RUNNING"
	status.LastRunAt = &now
	status.CurrentSourceFileID = &fileID
	status.ErrorMessage = ""
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		return false, fmt.Errorf("failed to mark DAILY_FULL as RUNNING for resume: %w", err)
	}

	resumeLEI := leiCodeValue(interruptedFile.LastProcessedLEI)
	fileName := interruptedFile.FileName
	processed := interruptedFile.ProcessedRecords
	total := interruptedFile.TotalRecords

	log.Info().
		Str("source_file_id", fileID.String()).
		Str("file_name", fileName).
		Str("resume_from", resumeLEI).
		Int("processed", processed).
		Int("total", total).
		Msg("Auto-resuming interrupted full sync on startup")

	go func() {
		if err := s.leiService.ProcessSourceFileWithResume(fileID, resumeLEI); err != nil {
			status, getErr := s.leiService.GetProcessingStatus("DAILY_FULL")
			if getErr != nil {
				log.Error().Err(getErr).Msg("Failed to get DAILY_FULL status after resume failure")
				return
			}

			if strings.Contains(strings.ToLower(err.Error()), "source file not found") {
				log.Warn().
					Err(err).
					Str("source_file_id", fileID.String()).
					Msg("Auto-resume source file missing; resetting to IDLE and triggering fresh full sync")

				status.Status = "IDLE"
				status.ErrorMessage = "Auto-resume skipped: source file missing"
				status.CurrentSourceFileID = nil
				status.NextRunAt = s.calculateNextDailyFullRun()
				if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
					log.Error().Err(updateErr).Msg("Failed to reset DAILY_FULL status to IDLE after missing resume file")
					return
				}

				if freshErr := s.RunDailyFullSync(); freshErr != nil {
					log.Error().Err(freshErr).Msg("Fresh full sync failed after missing resume file")
				}
				return
			}

			status.Status = "FAILED"
			status.ErrorMessage = err.Error()
			status.CurrentSourceFileID = nil
			if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
				log.Error().Err(updateErr).Msg("Failed to set DAILY_FULL status to FAILED after resume failure")
			}
			log.Error().Err(err).Str("source_file_id", fileID.String()).Msg("Auto-resume full sync failed")
			return
		}

		status, getErr := s.leiService.GetProcessingStatus("DAILY_FULL")
		if getErr != nil {
			log.Error().Err(getErr).Msg("Failed to get DAILY_FULL status after resume success")
			return
		}

		now := time.Now()
		status.Status = "IDLE"
		status.LastSuccessAt = &now
		status.NextRunAt = s.calculateNextDailyFullRun()
		status.ErrorMessage = ""
		status.CurrentSourceFileID = nil
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to set DAILY_FULL status to IDLE after resume success")
			return
		}

		log.Info().Str("source_file_id", fileID.String()).Msg("Auto-resume full sync completed successfully")
	}()

	return true, nil
}

// DISABLED: dailyDeltaSyncLoop runs delta sync at configured interval
// Delta sync is currently disabled - using full sync only strategy
// Delta files cause issues and don't provide enough benefit for daily operations
// This function is kept for reference but is not called (see line 223)
/*
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
				if err := s.leiService.UpdateSourceFile(oldFile); err != nil {
					log.Error().Err(err).Str("file_id", oldFileID.String()).Msg("Failed to update timed out file status")
				}
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
					if err := s.leiService.UpdateProcessingStatus(jobStatus); err != nil {
						log.Error().Err(err).Str("job_type", jobType).Msg("Failed to update job status to RUNNING")
					}
					log.Info().Str("job_type", jobType).Str("previous_status", jobStatus.Status).Msg("Updated job status to RUNNING for file resume")
				}

				// FIX: Use checkpoint resume regardless of status (PENDING or IN_PROGRESS)
				resumeLEI := ""
				if leiCodeValue(file.LastProcessedLEI) != "" {
					resumeLEI = leiCodeValue(file.LastProcessedLEI)
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
						if updateErr := s.leiService.UpdateProcessingStatus(jobStatus); updateErr != nil {
							log.Error().Err(updateErr).Str("job_type", jobType).Msg("Failed to update job status to FAILED")
						}
					}
				} else {
					// Update job status to COMPLETED on success
					if jobStatus, getErr := s.leiService.GetProcessingStatus(jobType); getErr == nil {
						jobStatus.Status = "COMPLETED"
						now := time.Now()
						jobStatus.LastSuccessAt = &now
						jobStatus.ErrorMessage = ""
						jobStatus.CurrentSourceFileID = nil
						if updateErr := s.leiService.UpdateProcessingStatus(jobStatus); updateErr != nil {
							log.Error().Err(updateErr).Str("job_type", jobType).Msg("Failed to update job status to COMPLETED")
						}
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
*/

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
			// Reference data (countries, currencies, continents, languages) must be current
			// before LEI records are downloaded, because new countries referenced by GLEIF
			// data may not yet exist in the database.
			if err := s.RunDailyMasterDataSync(); err != nil {
				log.Error().Err(err).Msg("Master data sync failed; aborting full sync chain")
			} else if err := s.RunDailyFullSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run scheduled full sync")
			} else {
				// Level 2 sync is a dependent job: it must run after Level 1 completes
				// because Level 2 records reference LEI codes that must already exist.
				log.Info().Msg("Level 1 full sync succeeded, triggering dependent Level 2 sync")
				if err := s.RunLevel2Sync(); err != nil {
					log.Error().Err(err).Msg("Failed to run Level 2 sync after full sync")
				}
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
	status.ErrorMessage = ""
	status.CurrentSourceFileID = nil
	now := time.Now()
	status.LastRunAt = &now
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	return s.doDeltaSyncWork(status, now)
}

// doDeltaSyncWork executes the download-and-process pipeline for a DAILY_DELTA job whose status
// has already been set to RUNNING by the caller.
func (s *schedulerService) doDeltaSyncWork(status *domain.FileProcessingStatus, now time.Time) error {
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
			if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
				log.Error().Err(updateErr).Msg("Failed to update delta sync status to COMPLETED")
			}
			return nil
		}
		// Real error
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to update delta sync status to FAILED")
		}
		return err
	}

	// Update status with current file
	status.CurrentSourceFileID = &sourceFile.ID
	if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
		log.Error().Err(updateErr).Msg("Failed to update delta sync current file")
	}

	// Process file
	if err := s.leiService.ProcessSourceFile(sourceFile.ID); err != nil {
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to update delta sync processing status to FAILED")
		}
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
	status.ErrorMessage = ""
	now := time.Now()
	status.LastRunAt = &now
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	return s.doFullSyncWork(status, now)
}

// doFullSyncWork executes the download-and-process pipeline for a DAILY_FULL job whose status
// has already been set to RUNNING by the caller.
func (s *schedulerService) doFullSyncWork(status *domain.FileProcessingStatus, now time.Time) error {
	// Download full file
	sourceFile, err := s.leiService.DownloadFullFile()
	if err != nil {
		// Check if this is a duplicate file (already processed)
		if strings.Contains(err.Error(), "duplicate file already processed") {
			// This is success - no new data to process
			log.Info().Msg("No new full file available (duplicate hash detected)")
			status.Status = "IDLE"
			status.LastSuccessAt = &now
			status.NextRunAt = s.calculateNextDailyFullRun()
			status.ErrorMessage = ""
			if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
				log.Error().Err(updateErr).Msg("Failed to update full sync status to IDLE")
			}
			return nil
		}
		// Real error
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to update full sync status to FAILED")
		}
		return err
	}

	// Update status with current file
	status.CurrentSourceFileID = &sourceFile.ID
	if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
		log.Error().Err(updateErr).Msg("Failed to update full sync current file")
	}

	// Process file (can resume if interrupted)
	var resumeLEI string
	if leiCodeValue(sourceFile.LastProcessedLEI) != "" {
		resumeLEI = leiCodeValue(sourceFile.LastProcessedLEI)
		log.Info().Str("resume_from", resumeLEI).Msg("Resuming file processing")
	}

	if err := s.leiService.ProcessSourceFileWithResume(sourceFile.ID, resumeLEI); err != nil {
		status.Status = "FAILED"
		status.ErrorMessage = err.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(status); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to update full sync processing status to FAILED")
		}
		return err
	}

	// Update status - transition from RUNNING -> COMPLETED -> IDLE
	// COMPLETED is transient and immediately becomes IDLE (waiting for next run)
	status.Status = "IDLE"
	status.LastSuccessAt = &now
	status.NextRunAt = s.calculateNextDailyFullRun()
	status.ErrorMessage = ""
	if err := s.leiService.UpdateProcessingStatus(status); err != nil {
		log.Error().Err(err).Msg("Failed to update processing status")
	}

	log.Info().Msg("Daily full sync completed successfully, status set to IDLE")
	return nil
}

// calculateNextRun calculates the next run time based on interval
func calculateNextRun(interval time.Duration) *time.Time {
	next := time.Now().Add(interval)
	return &next
}

// calculateNextDailyFullRun calculates next run at configured daily time (default 2 AM)
func (s *schedulerService) calculateNextDailyFullRun() *time.Time {
	now := time.Now()
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), s.fullSyncHour, s.fullSyncMinute, 0, 0, now.Location())

	// If we've already passed today's scheduled time, schedule for tomorrow
	if nextRun.Before(now) || nextRun.Equal(now) {
		nextRun = nextRun.AddDate(0, 0, 1)
	}

	return &nextRun
}

// DEPRECATED: calculateNextWeeklyRun calculates next Sunday at 2 AM
// This function is no longer used - use calculateNextDailyFullRun() instead for daily scheduling
// Kept for reference only
/*
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
*/

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

// dailyMasterDataSyncLoop runs master data sync at 1 AM daily (before LEI sync at 2 AM)
func (s *schedulerService) dailyMasterDataSyncLoop() {
	masterDataSyncHour := 1 // 1 AM - runs BEFORE LEI sync to ensure countries/currencies exist first
	masterDataSyncMinute := 0

	for {
		// Calculate next run time (daily at 1:00 AM)
		now := time.Now()
		nextRun := time.Date(now.Year(), now.Month(), now.Day(), masterDataSyncHour, masterDataSyncMinute, 0, 0, now.Location())
		if nextRun.Before(now) {
			nextRun = nextRun.AddDate(0, 0, 1)
		}

		duration := nextRun.Sub(now)
		log.Info().
			Time("next_run", nextRun).
			Dur("wait_duration", duration).
			Msg("Scheduled next master data sync")

		select {
		case <-time.After(duration):
			if err := s.RunDailyMasterDataSync(); err != nil {
				log.Error().Err(err).Msg("Failed to run scheduled master data sync")
			}
		case <-s.stopChan:
			log.Info().Msg("Stopping master data sync loop")
			return
		}
	}
}

// RunDailyMasterDataSync checks for master data updates and reloads if needed.
// It updates file_processing_status so the job is visible in the UI pipeline.
// Reference data (countries, currencies, continents, languages) must be current before
// GLEIF LEI records are processed, as new countries may be referenced by incoming LEI data.
func (s *schedulerService) RunDailyMasterDataSync() error {
	log.Info().Msg("Starting daily master data sync check")

	// Fetch or initialise the status row.
	st, err := s.leiService.GetProcessingStatus("MASTER_DATA_SYNC")
	if err != nil {
		now := time.Now()
		st = &domain.FileProcessingStatus{
			JobType:   "MASTER_DATA_SYNC",
			Status:    "IDLE",
			NextRunAt: s.calculateNextMasterDataRun(),
			CreatedAt: now,
			UpdatedAt: now,
		}
	}

	if st.Status == "RUNNING" {
		log.Warn().Msg("Master data sync already running, skipping")
		return nil
	}

	now := time.Now()
	st.Status = "RUNNING"
	st.LastRunAt = &now
	st.ErrorMessage = ""
	_ = s.leiService.UpdateProcessingStatus(st)

	return s.doMasterDataSyncWork(st, now)
}

// doMasterDataSyncWork checks for and applies master data updates for a MASTER_DATA_SYNC job
// whose status has already been set to RUNNING by the caller.
func (s *schedulerService) doMasterDataSyncWork(st *domain.FileProcessingStatus, now time.Time) error {
	// Check if master data files have been updated
	hasUpdates, err := s.masterDataService.CheckForUpdates()
	if err != nil {
		log.Error().Err(err).Msg("Failed to check for master data updates")
		st.Status = "FAILED"
		st.NextRunAt = s.calculateNextMasterDataRun()
		st.ErrorMessage = err.Error()
		_ = s.leiService.UpdateProcessingStatus(st)
		return err
	}

	if !hasUpdates {
		log.Info().Msg("No master data updates detected")
		successNow := time.Now()
		st.Status = "IDLE"
		st.LastSuccessAt = &successNow
		st.NextRunAt = s.calculateNextMasterDataRun()
		_ = s.leiService.UpdateProcessingStatus(st)
		return nil
	}

	log.Info().Msg("Master data updates detected, reloading...")

	// Reload all master data
	if err := s.masterDataService.LoadAllMasterData(); err != nil {
		log.Error().Err(err).Msg("Failed to reload master data")
		st.Status = "FAILED"
		st.NextRunAt = s.calculateNextMasterDataRun()
		st.ErrorMessage = err.Error()
		_ = s.leiService.UpdateProcessingStatus(st)
		return err
	}

	successNow := time.Now()
	st.Status = "IDLE"
	st.LastSuccessAt = &successNow
	st.NextRunAt = s.calculateNextMasterDataRun()
	st.ErrorMessage = ""
	_ = s.leiService.UpdateProcessingStatus(st)

	log.Info().Msg("Daily master data sync completed successfully")
	return nil
}

// RunLevel2Sync downloads and processes GLEIF Level 2 data (Relationship Records and Reporting
// Exceptions). This is a dependent job that must run after RunDailyFullSync completes because
// Level 2 records reference LEI codes that must already be present in lei_raw.lei_records.
func (s *schedulerService) RunLevel2Sync() error {
	return s.RunLevel2RRSync()
}

func (s *schedulerService) RunLevel2RRSync() error {
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status before Level 2 sync: %w", err)
	}

	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot run Level 2 sync while DAILY_FULL is RUNNING")
	}

	return s.runLevel2SyncFrom("LEVEL2_RR")
}

func (s *schedulerService) RunLevel2REPEXSync() error {
	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status before LEVEL2_REPEX sync: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot run LEVEL2_REPEX while DAILY_FULL is RUNNING")
	}

	rrStatus, err := s.leiService.GetProcessingStatus("LEVEL2_RR")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_RR status before LEVEL2_REPEX sync: %w", err)
	}
	if rrStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot run LEVEL2_REPEX while LEVEL2_RR is RUNNING")
	}

	return s.runLevel2SyncFrom("LEVEL2_REPEX")
}

func (s *schedulerService) calculateNextMasterDataRun() *time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), 1, 0, 0, 0, now.Location())
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}
	return &next
}

// runLevel2SyncFrom processes Level 2 sub-jobs beginning at startFrom.
//
//	"LEVEL2_RR"    — run RR first, then REPEX (the normal full Level 2 flow)
//	"LEVEL2_REPEX" — skip RR (already succeeded) and run REPEX only (recovery path)
func (s *schedulerService) runLevel2SyncFrom(startFrom string) error {
	log.Info().Str("start_from", startFrom).Msg("Starting Level 2 sync (who owns whom)")

	// --- Relationship Records (RR) ---
	if startFrom != "LEVEL2_REPEX" {
		rrStatus, err := s.leiService.GetProcessingStatus("LEVEL2_RR")
		if err != nil {
			rrStatus = &domain.FileProcessingStatus{
				JobType:          "LEVEL2_RR",
				Status:           "IDLE",
				DependsOnJobType: "DAILY_FULL",
			}
		}

		if rrStatus.Status == "RUNNING" {
			log.Warn().Msg("Level 2 RR sync already running, skipping")
		} else {
			now := time.Now()
			rrStatus.Status = "RUNNING"
			rrStatus.ErrorMessage = ""
			rrStatus.LastRunAt = &now
			if updateErr := s.leiService.UpdateProcessingStatus(rrStatus); updateErr != nil {
				log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_RR status to RUNNING")
			}

			if rrErr := s.doRRWork(rrStatus, now); rrErr != nil {
				// If RR failed, do not attempt REPEX — it depends on RR data being current.
				return rrErr
			}
		}
	}

	// --- Reporting Exceptions (REPEX) ---
	repexStatus, err := s.leiService.GetProcessingStatus("LEVEL2_REPEX")
	if err != nil {
		repexStatus = &domain.FileProcessingStatus{
			JobType:          "LEVEL2_REPEX",
			Status:           "IDLE",
			DependsOnJobType: "LEVEL2_RR",
		}
	}

	if repexStatus.Status == "RUNNING" {
		log.Warn().Msg("Level 2 REPEX sync already running, skipping")
		return nil
	}

	now := time.Now()
	repexStatus.Status = "RUNNING"
	repexStatus.ErrorMessage = ""
	repexStatus.LastRunAt = &now
	if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
		log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_REPEX status to RUNNING")
	}

	return s.doREPEXWork(repexStatus, now)
}

// doRRWork executes the download-and-process pipeline for a LEVEL2_RR job whose status has
// already been set to RUNNING by the caller. It updates the status record on completion.
func (s *schedulerService) doRRWork(rrStatus *domain.FileProcessingStatus, now time.Time) error {
	rrFile, downloadErr := s.leiLevel2Service.DownloadRRFile()
	if downloadErr != nil {
		if strings.Contains(downloadErr.Error(), "duplicate file already processed") {
			log.Info().Msg("No new RR file available (duplicate hash detected)")
			rrStatus.Status = "IDLE"
			rrStatus.LastSuccessAt = &now
			rrStatus.ErrorMessage = ""
		} else {
			log.Error().Err(downloadErr).Msg("Failed to download RR file")
			rrStatus.Status = "FAILED"
			rrStatus.ErrorMessage = downloadErr.Error()
		}
		if updateErr := s.leiService.UpdateProcessingStatus(rrStatus); updateErr != nil {
			log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_RR status after download failure")
		}
		if rrStatus.Status == "FAILED" {
			return downloadErr
		}
		return nil
	}

	rrStatus.CurrentSourceFileID = &rrFile.ID
	if updateErr := s.leiService.UpdateProcessingStatus(rrStatus); updateErr != nil {
		log.Warn().Err(updateErr).Msg("Failed to attach current source file to LEVEL2_RR status")
	}

	if processErr := s.leiLevel2Service.ProcessRRFile(rrFile.ID); processErr != nil {
		log.Error().Err(processErr).Msg("Failed to process RR file")
		rrStatus.Status = "FAILED"
		rrStatus.ErrorMessage = processErr.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(rrStatus); updateErr != nil {
			log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_RR status after processing")
		}
		return processErr
	}

	successNow := time.Now()
	rrStatus.Status = "IDLE"
	rrStatus.LastSuccessAt = &successNow
	rrStatus.ErrorMessage = ""
	log.Info().Msg("Level 2 RR sync completed successfully")
	if updateErr := s.leiService.UpdateProcessingStatus(rrStatus); updateErr != nil {
		log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_RR status after processing")
	}
	return nil
}

// doREPEXWork executes the download-and-process pipeline for a LEVEL2_REPEX job whose status has
// already been set to RUNNING by the caller. It updates the status record on completion.
func (s *schedulerService) doREPEXWork(repexStatus *domain.FileProcessingStatus, now time.Time) error {
	repexFile, downloadErr := s.leiLevel2Service.DownloadREPEXFile()
	if downloadErr != nil {
		if strings.Contains(downloadErr.Error(), "duplicate file already processed") {
			log.Info().Msg("No new REPEX file available (duplicate hash detected)")
			repexStatus.Status = "IDLE"
			repexStatus.LastSuccessAt = &now
			repexStatus.ErrorMessage = ""
			if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
				log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_REPEX status after duplicate detection")
			}
			log.Info().Msg("Level 2 sync (who owns whom) completed successfully")
			return nil
		}
		log.Error().Err(downloadErr).Msg("Failed to download REPEX file")
		repexStatus.Status = "FAILED"
		repexStatus.ErrorMessage = downloadErr.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
			log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_REPEX status after download failure")
		}
		return downloadErr
	}

	repexStatus.CurrentSourceFileID = &repexFile.ID
	if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
		log.Warn().Err(updateErr).Msg("Failed to attach current source file to LEVEL2_REPEX status")
	}

	if processErr := s.leiLevel2Service.ProcessREPEXFile(repexFile.ID); processErr != nil {
		log.Error().Err(processErr).Msg("Failed to process REPEX file")
		repexStatus.Status = "FAILED"
		repexStatus.ErrorMessage = processErr.Error()
		if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
			log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_REPEX status after processing failure")
		}
		return processErr
	}

	successNow := time.Now()
	repexStatus.Status = "IDLE"
	repexStatus.LastSuccessAt = &successNow
	repexStatus.ErrorMessage = ""
	if updateErr := s.leiService.UpdateProcessingStatus(repexStatus); updateErr != nil {
		log.Warn().Err(updateErr).Msg("Failed to update LEVEL2_REPEX status after success")
	}

	log.Info().Msg("Level 2 sync (who owns whom) completed successfully")
	return nil
}

// --------------------------------------------------------------------------
// Trigger* methods – HTTP-handler entry-points with atomic conflict detection
// --------------------------------------------------------------------------

// TriggerFullSync validates that neither MASTER_DATA_SYNC nor DAILY_FULL is currently
// running, then spawns RunDailyFullSync in a goroutine and returns immediately.
func (s *schedulerService) TriggerFullSync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	masterStatus, err := s.leiService.GetProcessingStatus("MASTER_DATA_SYNC")
	if err != nil {
		return fmt.Errorf("failed to validate MASTER_DATA_SYNC status: %w", err)
	}
	if masterStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start Full Sync while MASTER_DATA_SYNC is running: %w", ErrJobRunning)
	}

	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("DAILY_FULL is already running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunDailyFullSync(); err != nil {
			log.Error().Err(err).Msg("manual full sync failed")
		}
	}()
	return nil
}

// TriggerDeltaSync validates that neither DAILY_DELTA nor DAILY_FULL is currently
// running, then spawns RunDailyDeltaSync in a goroutine and returns immediately.
func (s *schedulerService) TriggerDeltaSync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	deltaStatus, err := s.leiService.GetProcessingStatus("DAILY_DELTA")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_DELTA status: %w", err)
	}
	if deltaStatus.Status == "RUNNING" {
		return fmt.Errorf("DAILY_DELTA is already running: %w", ErrJobRunning)
	}

	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start DAILY_DELTA while DAILY_FULL is running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunDailyDeltaSync(); err != nil {
			log.Error().Err(err).Msg("manual delta sync failed")
		}
	}()
	return nil
}

// TriggerMasterDataSync validates that MASTER_DATA_SYNC is not already running,
// then spawns RunDailyMasterDataSync in a goroutine and returns immediately.
func (s *schedulerService) TriggerMasterDataSync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	masterStatus, err := s.leiService.GetProcessingStatus("MASTER_DATA_SYNC")
	if err != nil {
		return fmt.Errorf("failed to validate MASTER_DATA_SYNC status: %w", err)
	}
	if masterStatus.Status == "RUNNING" {
		return fmt.Errorf("MASTER_DATA_SYNC is already running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunDailyMasterDataSync(); err != nil {
			log.Error().Err(err).Msg("manual master data sync failed")
		}
	}()
	return nil
}

// TriggerLevel2Sync validates that DAILY_FULL, LEVEL2_RR, and LEVEL2_REPEX are not running,
// then spawns RunLevel2Sync in a goroutine and returns immediately.
func (s *schedulerService) TriggerLevel2Sync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start Level 2 while DAILY_FULL is running: %w", ErrJobRunning)
	}

	rrStatus, err := s.leiService.GetProcessingStatus("LEVEL2_RR")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_RR status: %w", err)
	}
	if rrStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start Level 2 while LEVEL2_RR is running: %w", ErrJobRunning)
	}

	repexStatus, err := s.leiService.GetProcessingStatus("LEVEL2_REPEX")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_REPEX status: %w", err)
	}
	if repexStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start Level 2 while LEVEL2_REPEX is running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunLevel2Sync(); err != nil {
			log.Error().Err(err).Msg("manual Level 2 sync failed")
		}
	}()
	return nil
}

// TriggerLevel2RRSync validates that DAILY_FULL and LEVEL2_RR are not running,
// then spawns RunLevel2RRSync in a goroutine and returns immediately.
func (s *schedulerService) TriggerLevel2RRSync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start LEVEL2_RR while DAILY_FULL is running: %w", ErrJobRunning)
	}

	rrStatus, err := s.leiService.GetProcessingStatus("LEVEL2_RR")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_RR status: %w", err)
	}
	if rrStatus.Status == "RUNNING" {
		return fmt.Errorf("LEVEL2_RR is already running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunLevel2RRSync(); err != nil {
			log.Error().Err(err).Msg("manual LEVEL2_RR sync failed")
		}
	}()
	return nil
}

// TriggerLevel2REPEXSync validates that DAILY_FULL, LEVEL2_RR, and LEVEL2_REPEX are not running,
// then spawns RunLevel2REPEXSync in a goroutine and returns immediately.
func (s *schedulerService) TriggerLevel2REPEXSync() error {
	s.triggerMu.Lock()
	defer s.triggerMu.Unlock()

	fullStatus, err := s.leiService.GetProcessingStatus("DAILY_FULL")
	if err != nil {
		return fmt.Errorf("failed to validate DAILY_FULL status: %w", err)
	}
	if fullStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start LEVEL2_REPEX while DAILY_FULL is running: %w", ErrJobRunning)
	}

	rrStatus, err := s.leiService.GetProcessingStatus("LEVEL2_RR")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_RR status: %w", err)
	}
	if rrStatus.Status == "RUNNING" {
		return fmt.Errorf("cannot start LEVEL2_REPEX while LEVEL2_RR is running: %w", ErrJobRunning)
	}

	repexStatus, err := s.leiService.GetProcessingStatus("LEVEL2_REPEX")
	if err != nil {
		return fmt.Errorf("failed to validate LEVEL2_REPEX status: %w", err)
	}
	if repexStatus.Status == "RUNNING" {
		return fmt.Errorf("LEVEL2_REPEX is already running: %w", ErrJobRunning)
	}

	go func() {
		if err := s.RunLevel2REPEXSync(); err != nil {
			log.Error().Err(err).Msg("manual LEVEL2_REPEX sync failed")
		}
	}()
	return nil
}
