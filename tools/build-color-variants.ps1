# =============================================================================
# LUXA - build-color-variants.ps1
# Regenera data/color-variants.json escaneando assets/Imagenes/Imagenes_colors/.
# Corre esto cada vez que agregues o cambies carpetas de color para que la app
# detecte las variantes nuevas.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools/build-color-variants.ps1
#
# Convencion de la carpeta:
#   assets/Imagenes/Imagenes_colors/
#     <basename-del-render>/         <- exactamente como el filename original
#       white.jpeg                   <- cada archivo es una variante de color
#       black.jpeg
#       gold.jpeg
# =============================================================================
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'assets/Imagenes/Imagenes_colors'
$target = Join-Path $root 'data/color-variants.json'

if (-not (Test-Path $source)) {
  Write-Host "No existe la carpeta $source" -ForegroundColor Red
  exit 1
}

# Orden de los colores cuando aparecen juntos (white primero, despues black, despues gold,
# y al final cualquier color desconocido). La app es la que termina decidiendo cual es
# el "default" segun el render original, asi que este orden solo afecta la apariencia
# del array dentro del JSON.
$colorOrder = @{ white = 0; black = 1; gold = 2 }

# Leer el manifest anterior (si existe) para detectar diffs y preservar el _readme.
$previousVariants = @{}
$readme = 'Manifest de variantes de color para luminarias del catalogo. Generado a partir de las subcarpetas de assets/Imagenes/Imagenes_colors/. La key de cada entry es el basename del filename original del render (assets.image del producto, sin extension). La app lo lee al boot y attacha las variantes al producto correspondiente. Para regenerar despues de agregar/quitar variantes, correr tools/build-color-variants.ps1.'
if (Test-Path $target) {
  try {
    $old = Get-Content -Raw -Path $target -Encoding UTF8 | ConvertFrom-Json
    if ($old._readme) { $readme = [string]$old._readme }
    foreach ($prop in $old.variants.PSObject.Properties) {
      $previousVariants[$prop.Name] = ($prop.Value | ForEach-Object { $_.id }) -join ','
    }
  } catch {
    Write-Host "Manifest previo no se pudo leer (corrupto?). Sigo y lo regenero." -ForegroundColor Yellow
  }
}

# Escanear las subcarpetas y armar la lista de variantes.
$variants = [ordered]@{}
$dirs = Get-ChildItem -Path $source -Directory | Sort-Object Name
foreach ($d in $dirs) {
  $files = Get-ChildItem -Path $d.FullName -File |
           Where-Object { $_.Extension -match '^\.(jpe?g|png|webp)$' }
  if (-not $files) { continue }
  $sorted = $files | Sort-Object @{
    Expression = {
      $key = $_.BaseName.ToLower()
      if ($colorOrder.ContainsKey($key)) { $colorOrder[$key] } else { 99 }
    }
  }
  $list = @()
  foreach ($f in $sorted) {
    $list += [ordered]@{
      id    = $f.BaseName.ToLower()
      image = "assets/Imagenes/Imagenes_colors/$($d.Name)/$($f.Name)"
    }
  }
  $variants[$d.Name] = $list
}

# Diff vs el manifest previo (info nada mas).
$prevKeys = [System.Collections.Generic.HashSet[string]]::new()
foreach ($k in $previousVariants.Keys) { [void]$prevKeys.Add($k) }
$newKeys  = [System.Collections.Generic.HashSet[string]]::new()
foreach ($k in $variants.Keys)         { [void]$newKeys.Add($k) }

$added   = $newKeys  | Where-Object { -not $prevKeys.Contains($_) }
$removed = $prevKeys | Where-Object { -not $newKeys.Contains($_) }
$changed = @()
foreach ($k in $newKeys) {
  if ($prevKeys.Contains($k)) {
    $newIds = ($variants[$k] | ForEach-Object { $_.id }) -join ','
    if ($newIds -ne $previousVariants[$k]) { $changed += $k }
  }
}

Write-Host ""
Write-Host "Manifest de color variants" -ForegroundColor Cyan
Write-Host "  Carpetas escaneadas: $($dirs.Count)"
Write-Host "  Entries publicadas:  $($variants.Count)"
if ($added.Count   -gt 0) { Write-Host "  + Agregados ($($added.Count)):"   -ForegroundColor Green; $added   | ForEach-Object { Write-Host "      $_" } }
if ($removed.Count -gt 0) { Write-Host "  - Removidos ($($removed.Count)):" -ForegroundColor Yellow; $removed | ForEach-Object { Write-Host "      $_" } }
if ($changed.Count -gt 0) { Write-Host "  ~ Cambiados ($($changed.Count)):" -ForegroundColor Magenta; $changed | ForEach-Object { Write-Host "      $_" } }
if ($added.Count -eq 0 -and $removed.Count -eq 0 -and $changed.Count -eq 0) {
  Write-Host "  No hay cambios respecto al manifest anterior." -ForegroundColor DarkGray
}
Write-Host ""

if ($DryRun) {
  Write-Host "DryRun activo: no escribo el archivo." -ForegroundColor Yellow
  return
}

# Escribir JSON con formato lindo (una linea por variante, dos espacios de indent).
$keys = @($variants.Keys)
$lastKey = $keys[-1]
$lines = New-Object System.Collections.Generic.List[string]
[void]$lines.Add('{')
[void]$lines.Add('  "_readme": ' + ($readme | ConvertTo-Json) + ',')
[void]$lines.Add('  "generatedAt": ' + ((Get-Date).ToString('yyyy-MM-dd') | ConvertTo-Json) + ',')
[void]$lines.Add('  "variants": {')
foreach ($k in $keys) {
  $list = $variants[$k]
  [void]$lines.Add('    ' + ($k | ConvertTo-Json) + ': [')
  for ($i = 0; $i -lt $list.Count; $i++) {
    $v = $list[$i]
    $line = '      { "id": ' + ($v.id | ConvertTo-Json) + ', "image": ' + ($v.image | ConvertTo-Json) + ' }'
    if ($i -lt $list.Count - 1) { $line += ',' }
    [void]$lines.Add($line)
  }
  $close = '    ]'
  if ($k -ne $lastKey) { $close += ',' }
  [void]$lines.Add($close)
}
[void]$lines.Add('  }')
[void]$lines.Add('}')

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($target, ($lines -join "`n") + "`n", $utf8NoBom)

Write-Host "Escrito: $target" -ForegroundColor Green
Write-Host "Listo. Acordate de hacer commit/push para que llegue a Vercel." -ForegroundColor DarkGray
