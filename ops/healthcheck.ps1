param(
  [string]$HealthUrl = "http://localhost:3000/api/health"
)

$ErrorActionPreference = "Stop"

Write-Host "[healthcheck] Checking docker compose service state..."
$psOutput = docker compose ps
if ($LASTEXITCODE -ne 0) {
  throw "docker compose ps failed"
}
$psOutput | Write-Host

$badStates = @("Exit", "unhealthy", "Restarting", "Dead")
foreach ($line in ($psOutput -split "`r?`n")) {
  foreach ($state in $badStates) {
    if ($line -match $state) {
      throw "Service in bad state detected: $line"
    }
  }
}

Write-Host "[healthcheck] Checking app endpoint: $HealthUrl"
$response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 15
if (-not $response.ok) {
  throw "Health endpoint did not return ok=true"
}

Write-Host "[healthcheck] All checks passed." -ForegroundColor Green
