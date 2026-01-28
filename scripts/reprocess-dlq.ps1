#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Reprocesses messages from Dead Letter Queue back to main queue
.DESCRIPTION
    Moves messages from a DLQ back to the main exchange for reprocessing.
    Uses RabbitMQ shovel for efficient bulk transfer.
.PARAMETER DLQName
    Name of the Dead Letter Queue to reprocess
.PARAMETER Exchange
    Target exchange name
.PARAMETER RoutingKey
    Routing key for republishing messages
.PARAMETER VHost
    RabbitMQ virtual host (default: /axiom)
.EXAMPLE
    .\scripts\reprocess-dlq.ps1 -DLQName "axiom.reference.countries.dlq" -Exchange "axiom.data.exchange" -RoutingKey "reference.countries"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DLQName,
    
    [Parameter(Mandatory=$true)]
    [string]$Exchange,
    
    [Parameter(Mandatory=$true)]
    [string]$RoutingKey,
    
    [Parameter(Mandatory=$false)]
    [string]$VHost = "/axiom",
    
    [Parameter(Mandatory=$false)]
    [string]$Container = "axiom-rabbitmq",
    
    [Parameter(Mandatory=$false)]
    [string]$User = "axiom",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "changeme"
)

Write-Host "Reprocessing DLQ: $DLQName" -ForegroundColor Cyan
Write-Host "Target: $Exchange / $RoutingKey" -ForegroundColor Cyan

# Get message count
$queueOutput = docker exec $Container rabbitmqadmin -u $User -p $Password -V $VHost list queues name messages 2>$null
$messageCount = 0
foreach ($line in $queueOutput) {
    if ($line -match "^\|\s*$DLQName\s*\|\s*(\d+)\s*\|") {
        $messageCount = [int]$matches[1]
        break
    }
}

if ($messageCount -eq 0) {
    Write-Host "No messages in DLQ to reprocess" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $messageCount messages to reprocess" -ForegroundColor Green

# Process messages one at a time using get + publish
Write-Host "Reprocessing messages..." -ForegroundColor Cyan

$processed = 0
$failed = 0

for ($i = 1; $i -le $messageCount; $i++) {
    try {
        # Get one message from DLQ (requeue=false removes it from DLQ)
        $msgJson = docker exec $Container rabbitmqadmin -u $User -p $Password -V $VHost get queue=$DLQName count=1 requeue=false ack-mode=ack_requeue_false --format=raw_json 2>$null
        
        if (-not $msgJson -or $msgJson.Length -eq 0) {
            break  # No more messages
        }
        
        $msg = $msgJson | ConvertFrom-Json
        if ($msg -and $msg.Count -gt 0) {
            $payload = $msg[0].payload
            
            # Republish to main exchange
            $null = docker exec $Container sh -c "echo '$payload' | rabbitmqadmin -u $User -p $Password -V '$VHost' publish exchange=$Exchange routing_key=$RoutingKey payload=-" 2>$null
            $processed++
            
            if ($processed % 10 -eq 0) {
                $percentComplete = [math]::Round(($processed / $messageCount) * 100, 1)
                Write-Host "Progress: $processed / $messageCount ($percentComplete%)" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Host "Error processing message $i : $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
if ($failed -gt 0) {
    Write-Host "Reprocessing complete with errors:" -ForegroundColor Yellow
    Write-Host "  Processed: $processed" -ForegroundColor Green
    Write-Host "  Failed: $failed" -ForegroundColor Red
} else {
    Write-Host "Reprocessing complete! Processed $processed messages successfully." -ForegroundColor Green
}
