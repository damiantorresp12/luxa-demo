# =============================================================================
# LUXA · apply-spaces.ps1
# Pega un spaces.json descargado desde el Space Planner en data/spaces.json
# del proyecto. Valida que sea JSON válido y que la estructura sea correcta.
#
# Uso típico:
#   1. En el Space Planner, click "Export to data/spaces.json"
#   2. powershell -ExecutionPolicy Bypass -File tools/apply-spaces.ps1
#      (por defecto busca el último spaces.json en %USERPROFILE%\Downloads)
#
#   O pasando una ruta explícita:
#   powershell -ExecutionPolicy Bypass -File tools/apply-spaces.ps1 -Source "C:\ruta\al\spaces.json"
# =============================================================================
param(
  [string]$Source = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'data\spaces.json'

# 1) Locate the source file
if (-not $Source) {
  $downloads = Join-Path $env:USERPROFILE 'Downloads'
  if (-not (Test-Path $downloads)) {
    Write-Host "Downloads folder not found. Pass -Source <path> explicitly." -ForegroundColor Red
    exit 1
  }
  $candidate = Get-ChildItem -Path $downloads -Filter 'spaces*.json' -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending |
               Select-Object -First 1
  if (-not $candidate) {
    Write-Host "No spaces*.json found in $downloads. Export from the Space Planner first." -ForegroundColor Red
    exit 1
  }
  $Source = $candidate.FullName
  Write-Host "Source (auto): $Source"
} elseif (-not (Test-Path $Source)) {
  Write-Host "Source file not found: $Source" -ForegroundColor Red
  exit 1
}

# 2) Validate JSON
try {
  $json = Get-Content -Raw -Path $Source | ConvertFrom-Json
} catch {
  Write-Host "Source is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$entries = @()
if ($json.entries) { $entries = $json.entries }
elseif ($json.spaces) { $entries = $json.spaces }

if (-not $entries -or $entries.Count -eq 0) {
  Write-Host "JSON has no 'entries' or 'spaces' array — nothing to apply." -ForegroundColor Yellow
  exit 0
}

# 3) Sanity check on each entry
$missingId = 0
$missingImage = 0
$missingHotspots = 0
foreach ($e in $entries) {
  if (-not $e.id) { $missingId++ }
  if (-not $e.image) { $missingImage++ }
  if (-not $e.hotspots -or $e.hotspots.Count -eq 0) { $missingHotspots++ }
}
if ($missingId -gt 0) {
  Write-Host "$missingId entries missing 'id'. Aborting." -ForegroundColor Red
  exit 1
}
if (($missingImage -gt 0 -or $missingHotspots -gt 0) -and -not $Force) {
  Write-Host "Warning: $missingImage missing image, $missingHotspots missing hotspots." -ForegroundColor Yellow
  Write-Host "Re-run with -Force to apply anyway."
  exit 1
}

# 4) Backup current target if it exists
if (Test-Path $target) {
  $backup = "$target.bak"
  Copy-Item -Path $target -Destination $backup -Force
  Write-Host "Backup: $backup"
}

# 5) Write
$null = New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force
Copy-Item -Path $Source -Destination $target -Force

Write-Host "Applied $($entries.Count) scene(s) to $target" -ForegroundColor Green
foreach ($e in $entries) {
  $hs = if ($e.hotspots) { $e.hotspots.Count } else { 0 }
  Write-Host "  · $($e.id) — $hs hotspot(s)"
}
Write-Host ""
Write-Host "Reload the LUXA app in the browser to see the changes." -ForegroundColor Cyan
