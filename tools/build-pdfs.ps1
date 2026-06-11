# =============================================================================
# LUXA - Generador de PDFs de muestra para la seccion Downloads.
# Crea PDFs validos de 1 pagina (con xref correcto) en assets/pdfs/.
# Re-ejecutable. Uso:  powershell -ExecutionPolicy Bypass -File tools/build-pdfs.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets\pdfs'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

function Esc([string]$s) {
  $s.Replace('\','\\').Replace('(','\(').Replace(')','\)')
}

function New-LuxaPdf {
  param([string]$Path, [string]$Title, [string]$Kind, [string[]]$Lines)

  $nl = "`n"

  # --- content stream ---
  $c  = "BT /F1 30 Tf 60 770 Td ($(Esc 'LUXA')) Tj ET" + $nl
  $c += "BT /F2 10 Tf 60 752 Td ($(Esc 'TD LIGHTING EXPERIENCE')) Tj ET" + $nl
  $c += "BT /F2 11 Tf 60 700 Td ($(Esc $Kind.ToUpper())) Tj ET" + $nl
  $c += "BT /F1 22 Tf 60 672 Td ($(Esc $Title)) Tj ET" + $nl
  $y = 630
  foreach ($ln in $Lines) {
    $c += "BT /F2 12 Tf 60 $y Td ($(Esc $ln)) Tj ET" + $nl
    $y -= 22
  }
  $c += "BT /F2 9 Tf 60 80 Td ($(Esc 'Fictional brand - sample document generated for the LUXA interactive catalog demo.')) Tj ET" + $nl

  # --- objects ---
  $objs = @()
  $objs += "<< /Type /Catalog /Pages 2 0 R >>"
  $objs += "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
  $objs += "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"
  $objs += "<< /Length $($c.Length) >>" + $nl + "stream" + $nl + $c + "endstream"
  $objs += "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  $objs += "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

  # --- assemble with byte offsets ---
  $header = "%PDF-1.4" + $nl
  $body   = ""
  $offsets = @()
  for ($i = 0; $i -lt $objs.Count; $i++) {
    $offsets += ($header.Length + $body.Length)
    $body += "$($i+1) 0 obj" + $nl + $objs[$i] + $nl + "endobj" + $nl
  }

  $xrefPos = $header.Length + $body.Length
  $n = $objs.Count + 1
  $xref  = "xref" + $nl + "0 $n" + $nl + "0000000000 65535 f " + $nl
  foreach ($off in $offsets) {
    $xref += ("{0:D10} 00000 n " -f $off) + $nl
  }
  $trailer = "trailer" + $nl + "<< /Size $n /Root 1 0 R >>" + $nl +
             "startxref" + $nl + "$xrefPos" + $nl + "%%EOF"

  $pdf = $header + $body + $xref + $trailer
  [System.IO.File]::WriteAllText($Path, $pdf, [System.Text.Encoding]::ASCII)
  Write-Host "  + $([System.IO.Path]::GetFileName($Path))"
}

Write-Host "Generating LUXA sample PDFs ->" $outDir

New-LuxaPdf -Path (Join-Path $outDir 'luxa-general-catalog-2026.pdf') `
  -Title 'General Catalog 2026' -Kind 'Catalog' -Lines @(
  'The complete LUXA collection.',
  'Pendants - Chandeliers - Floor - Table - Wall - Ceiling - Downlights.',
  'Finishes, photometric data and dimensions for every fixture.',
  '128 pages.')

New-LuxaPdf -Path (Join-Path $outDir 'downlights-technical-sheet.pdf') `
  -Title 'Downlights Technical Sheet' -Kind 'Technical' -Lines @(
  'Recessed downlight range.',
  'Cut-outs, beam angles, driver options and IP ratings.',
  'CRI >= 90 across the family.')

New-LuxaPdf -Path (Join-Path $outDir 'spotlights-collection.pdf') `
  -Title 'Spotlights Collection' -Kind 'Collection' -Lines @(
  'Adjustable and track-mounted accent lighting.',
  'For retail and residential applications.')

New-LuxaPdf -Path (Join-Path $outDir 'linear-systems-guide.pdf') `
  -Title 'Linear Systems Guide' -Kind 'Guide' -Lines @(
  'Continuous-run profiles and connectors.',
  'Suspension and recessed mounting details.')

Write-Host "Done."
