@echo off
REM =============================================================================
REM Axiom API Smoke Test Wrapper (Windows CMD)
REM
REM Purpose:
REM   Provide a Windows-native entrypoint for scripts\smoke-api.ps1 when GNU make
REM   is not available.
REM
REM Usage:
REM   scripts\smoke-api.cmd
REM   scripts\smoke-api.cmd uat
REM   scripts\smoke-api.cmd prod --check-login
REM
REM Arguments:
REM   %1  Environment: main | dev | uat | prod | all (default: all)
REM   %2  Optional flag: --check-login
REM =============================================================================

setlocal

set "ENVIRONMENT=%~1"
set "CHECK_LOGIN=%~2"

if "%ENVIRONMENT%"=="" set "ENVIRONMENT=all"

REM Validate environment argument.
if /I not "%ENVIRONMENT%"=="main" if /I not "%ENVIRONMENT%"=="dev" if /I not "%ENVIRONMENT%"=="uat" if /I not "%ENVIRONMENT%"=="prod" if /I not "%ENVIRONMENT%"=="all" (
  echo [ERROR] Invalid environment: %ENVIRONMENT%
  echo         Valid values: main ^| dev ^| uat ^| prod ^| all
  exit /b 1
)

REM Resolve script directory to call PowerShell script reliably from any CWD.
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%smoke-api.ps1"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Missing script: "%PS_SCRIPT%"
  exit /b 1
)

set "PS_ARGS=-Environment %ENVIRONMENT%"
if /I "%CHECK_LOGIN%"=="--check-login" set "PS_ARGS=%PS_ARGS% -CheckLogin"

echo Running smoke checks: env=%ENVIRONMENT% check_login=%CHECK_LOGIN%

pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %PS_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo [FAIL] Smoke checks failed with exit code %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo [OK] Smoke checks passed.
exit /b 0
