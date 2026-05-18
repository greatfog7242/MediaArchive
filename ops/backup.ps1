param(
  [string]$OutputDir = "./backups"
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $OutputDir $timestamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$hostBackupDir = (Resolve-Path $backupDir).Path

Write-Host "[backup] Writing backup set to $backupDir"

if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER) -or [string]::IsNullOrWhiteSpace($env:POSTGRES_DB)) {
  throw "POSTGRES_USER and POSTGRES_DB must be set in the environment before running backup.ps1"
}

Write-Host "[backup] PostgreSQL dump..."
$pgDumpPath = Join-Path $backupDir "postgres.sql"
$pgDumpCommand = "docker compose -f docker-compose.yml exec -T postgres pg_dump -U $env:POSTGRES_USER $env:POSTGRES_DB"
cmd /c "$pgDumpCommand > \"$pgDumpPath\""
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL backup failed"
}

Write-Host "[backup] Redis snapshot..."
if ([string]::IsNullOrWhiteSpace($env:REDIS_PASSWORD)) {
  throw "REDIS_PASSWORD must be set in the environment before running backup.ps1"
}
docker compose -f docker-compose.yml exec -T redis redis-cli -a $env:REDIS_PASSWORD SAVE | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Redis SAVE failed"
}
docker compose -f docker-compose.yml cp redis:/data/dump.rdb "$backupDir/redis-dump.rdb" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Redis dump copy failed"
}

if ([string]::IsNullOrWhiteSpace($env:TYPESENSE_API_KEY)) {
  Write-Warning "TYPESENSE_API_KEY is not set; skipping Typesense snapshot"
} else {
  Write-Host "[backup] Typesense snapshot trigger..."
  $headers = @{ "X-Typesense-Api-Key" = $env:TYPESENSE_API_KEY }
  Invoke-RestMethod -Uri "http://localhost:8108/operations/snapshot" -Method Post -Headers $headers -TimeoutSec 30 | Out-Null

  Write-Host "[backup] Archiving Typesense data volume..."
  docker run --rm -v mediaarchive_tsdata:/from -v "${hostBackupDir}:/to" alpine sh -lc "tar czf /to/typesense-data.tar.gz -C /from ." | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Typesense data archive failed"
  }
}

@{
  timestamp = $timestamp
  backupDir = $backupDir
} | ConvertTo-Json | Set-Content (Join-Path $backupDir "manifest.json")

Write-Host "[backup] Completed successfully." -ForegroundColor Green
