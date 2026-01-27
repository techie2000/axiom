#!/usr/bin/env pwsh
# Script to publish test messages directly to RabbitMQ
# Simulates what canonicalizer would publish after processing csv2json output

param(
    [string]$RabbitMQHost = "localhost",
    [string]$RabbitMQPort = "5672",
    [string]$RabbitMQUser = "axiom",
    [string]$RabbitMQPassword = "",
    [string]$RabbitMQVHost = "/axiom",
    [string]$Queue = "axiom.reference.countries"
)

if ($RabbitMQPassword -eq "") {
    $RabbitMQPassword = Read-Host "Enter RabbitMQ password" -AsSecureString
    $RabbitMQPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($RabbitMQPassword)
    )
}

Write-Host "=== Publishing Test Messages to RabbitMQ ===" -ForegroundColor Cyan
Write-Host ""

$TestDataFile = "testdata\countries.json"
if (-not (Test-Path $TestDataFile)) {
    Write-Host "ERROR: Test data not found: $TestDataFile" -ForegroundColor Red
    exit 1
}

$jsonData = Get-Content $TestDataFile -Raw | ConvertFrom-Json
$countries = $jsonData.data

Write-Host "Found $($countries.Count) countries to publish" -ForegroundColor Green
Write-Host "Queue: $Queue" -ForegroundColor Gray
Write-Host ""

# Create message envelopes (as canonicalizer would format them)
$messages = @()
foreach ($country in $countries) {
    $envelope = @{
        domain = "reference"
        entity = "countries"
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        source = "test-script"
        payload = $country
    } | ConvertTo-Json -Compress
    
    $messages += $envelope
}

Write-Host "Generated $($messages.Count) message envelopes" -ForegroundColor Green
Write-Host ""

# Save messages to file for manual publishing
$messagesFile = "test_messages.json"
$messages | Out-File -FilePath $messagesFile -Encoding UTF8
Write-Host "Saved messages to: $messagesFile" -ForegroundColor Green
Write-Host ""

Write-Host "=== Publishing Options ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use RabbitMQ Management UI" -ForegroundColor Cyan
Write-Host "  1. Open http://${RabbitMQHost}:15672" -ForegroundColor White
Write-Host "  2. Login with credentials" -ForegroundColor White
Write-Host "  3. Go to Queues → $Queue → Publish Message" -ForegroundColor White
Write-Host "  4. Paste message envelope from $messagesFile" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Use rabbitmqadmin CLI" -ForegroundColor Cyan
Write-Host "  Download: http://${RabbitMQHost}:15672/cli/rabbitmqadmin" -ForegroundColor Gray
foreach ($i in 0..($messages.Count - 1)) {
    $msg = $messages[$i] -replace '"', '\"'
    Write-Host "  rabbitmqadmin publish routing_key='$Queue' payload='$msg'" -ForegroundColor White
    if ($i -ge 2) {
        Write-Host "  ... ($($messages.Count - 3) more)" -ForegroundColor Gray
        break
    }
}
Write-Host ""

Write-Host "Option 3: Use Go/Python RabbitMQ client" -ForegroundColor Cyan
Write-Host "  Write a simple publisher script that reads $messagesFile" -ForegroundColor White
Write-Host ""

Write-Host "Once published, the countries service should automatically process them!" -ForegroundColor Green
Write-Host ""

# Display sample message
Write-Host "=== Sample Message Envelope ===" -ForegroundColor Yellow
Write-Host $messages[0] -ForegroundColor White
Write-Host ""

Write-Host "Script complete!" -ForegroundColor Green
