# Remote Supabase Migration Push Script
# Usage:
#   $env:SUPABASE_DB_URL = "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
#   .\supabase\push_migrations.ps1
param(
  [string]$DbUrl = $env:SUPABASE_DB_URL
)

if (-not $DbUrl) {
  Write-Host "Set SUPABASE_DB_URL or pass -DbUrl before running." -ForegroundColor Yellow
  Write-Host "Or run supabase/migrations/0001_schema.sql, 0002_rls_and_security.sql, 0003_seed_sources.sql in Supabase SQL Editor." -ForegroundColor Cyan
  exit 1
}

$migrations = Get-ChildItem "$PSScriptRoot\migrations\*.sql" | Sort-Object Name
foreach ($file in $migrations) {
  Write-Host "Applying $($file.Name)..." -ForegroundColor Green
  psql $DbUrl -v ON_ERROR_STOP=1 -f $file.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "All Supabase migrations applied cleanly." -ForegroundColor Green
