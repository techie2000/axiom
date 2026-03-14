@echo off
REM =============================================================================
REM Axiom SSI Smoke Test Wrapper (Windows CMD)
REM
REM Purpose:
REM   Provide a Windows-native entrypoint for scripts\smoke-ssi.ps1 when GNU make
REM   is not available.
REM
REM Usage:
REM   scripts\smoke-ssi.cmd
REM   scripts\smoke-ssi.cmd uat
REM   scripts\smoke-ssi.cmd dev --seed --cleanup
REM
REM Arguments:
REM   %1  Environment: main | dev | uat | prod (default: dev)
REM   %2+ Optional flags: --seed --cleanup
REM =============================================================================

setlocal

set "ENVIRONMENT=%~1"
set "FLAG1=%~2"
set "FLAG2=%~3"

if "%ENVIRONMENT%"=="" set "ENVIRONMENT=dev"

REM If first arg is a flag, default environment to dev.
if "%ENVIRONMENT:~0,2%"=="--" (
  set "FLAG2=%FLAG1%"
  set "FLAG1=%ENVIRONMENT%"
  set "ENVIRONMENT=dev"
)

REM Validate environment argument.
if /I not "%ENVIRONMENT%"=="main" if /I not "%ENVIRONMENT%"=="dev" if /I not "%ENVIRONMENT%"=="uat" if /I not "%ENVIRONMENT%"=="prod" (
  echo [ERROR] Invalid environment: %ENVIRONMENT%
  echo         Valid values: main ^| dev ^| uat ^| prod
  exit /b 1
)

set "SEED_FLAG="
set "CLEANUP_FLAG="

if /I "%FLAG1%"=="--seed" set "SEED_FLAG=-SeedSmokeData"
if /I "%FLAG2%"=="--seed" set "SEED_FLAG=-SeedSmokeData"

if /I "%FLAG1%"=="--cleanup" set "CLEANUP_FLAG=-CleanupSmokeData"
if /I "%FLAG2%"=="--cleanup" set "CLEANUP_FLAG=-CleanupSmokeData"

REM Resolve script directory to call PowerShell script reliably from any CWD.
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%smoke-ssi.ps1"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Missing script: "%PS_SCRIPT%"
  exit /b 1
)

set "PS_ARGS=-Environment %ENVIRONMENT% %SEED_FLAG% %CLEANUP_FLAG%"

echo Running SSI smoke checks: env=%ENVIRONMENT% %FLAG1% %FLAG2%

pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %PS_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo [FAIL] SSI smoke checks failed with exit code %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo [OK] SSI smoke checks passed.
exit /b 0
