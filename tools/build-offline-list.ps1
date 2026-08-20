# =============================================================================
# LUXA - Armar la lista de archivos que la app guarda para funcionar sin internet
#
# La app instalable necesita saber exactamente que archivos bajarse para poder
# abrir despues sin señal. Este script recorre el proyecto y escribe esa lista
# en offline-files.json, que es lo que lee el "guardian" (js/sw.js).
#
# CUANDO CORRERLO: cada vez que agregues o saques renders, ambientes, videos o
# productos. Si no lo corres, la app sigue andando, pero los archivos nuevos
# solo se ven con internet.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\build-offline-list.ps1
#
# NO incluye: las herramientas internas (Generador y Planificador), los
# originales de los renders, los modelos de 3ds Max ni los respaldos .bak.
#
# Nota: sin acentos a proposito - Windows PowerShell lee este archivo como ANSI.
# =============================================================================

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ---- 1. El armazon: lo minimo para que la app abra --------------------------
# Esto se baja primero y si algo de aca falla, la instalacion no sirve.
$armazon = @(
  './',
  'index.html',
  'manifest.webmanifest',
  # La lista se guarda a si misma: sin senal el guardian la necesita para
  # saber que deberia tener guardado.
  'offline-files.json',
  'css/styles.css',
  'css/fonts.css',
  'js/brand.config.js',
  'js/catalog.data.js',
  'js/app.js',
  'js/compare.js',
  'js/pwa.js',
  'assets/favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'space-planner/catalogs.json'
)

# Las fuentes y los datos tambien son armazon: sin ellos la app abre fea o vacia.
Get-ChildItem (Join-Path $root 'assets\fonts') -File -ErrorAction SilentlyContinue |
  ForEach-Object { $armazon += 'assets/fonts/' + $_.Name }

Get-ChildItem (Join-Path $root 'data') -File -Filter '*.json' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notlike '*.bak.json' } |
  ForEach-Object { $armazon += 'data/' + $_.Name }

Get-ChildItem (Join-Path $root 'space-planner\catalogs') -Directory -ErrorAction SilentlyContinue |
  ForEach-Object {
    $meta = Join-Path $_.FullName 'meta.json'
    if (Test-Path $meta) { $armazon += 'space-planner/catalogs/' + $_.Name + '/meta.json' }
  }

# ---- 2. Lo pesado: fotos, ambientes y videos --------------------------------
# Esto se baja despues, de a poco y en segundo plano. Si alguno falla, no pasa
# nada: la app ya funciona y ese archivo se pide por internet cuando haga falta.
$pesados = @()

function Sumar-Carpeta {
  param([string]$Relativa, [string]$Patron)
  $dir = Join-Path $root ($Relativa -replace '/', '\')
  if (-not (Test-Path $dir)) { return @() }
  Get-ChildItem $dir -Recurse -File |
    Where-Object { $_.Extension -match $Patron -and $_.FullName -notmatch '\\_' } |
    ForEach-Object {
      ($_.FullName.Substring($root.Length + 1) -replace '\\', '/')
    }
}

# EL ORDEN IMPORTA: se guardan en este orden, asi que primero va lo que el
# cliente ve enseguida (fotos y ambientes) y los videos al final. Si la
# descarga se corta por el medio, ya quedo guardado lo que mas se usa.
$pesados += Sumar-Carpeta 'assets/Imagenes'     '^\.(jpe?g|png|webp)$'
$pesados += Sumar-Carpeta 'assets/Spaces'       '^\.(jpe?g|png|webp)$'
$pesados += Sumar-Carpeta 'assets/pdfs'         '^\.pdf$'
$pesados += 'assets/og-preview.jpg'
$pesados += Sumar-Carpeta 'assets/Transiciones' '^\.(mp4|webm)$'

$armazon = $armazon | Select-Object -Unique
$pesados = $pesados | Where-Object { $_ } | Select-Object -Unique

# ---- 3. Escribir la lista ---------------------------------------------------
# La "version" identifica al CONTENIDO, no al momento en que se corrio esto.
#
# Es importante que sea asi: cuando la version cambia, el celular del cliente
# tira los 108 MB que tenia guardados y baja todo de nuevo. Si la version fuera
# la fecha y hora, cada publicacion -aunque solo cambiara una linea de codigo-
# le costaria al cliente una descarga completa.
#
# Se arma con el nombre y el peso de los archivos PESADOS unicamente. El codigo
# queda afuera a proposito: la app lo busca siempre por internet y la copia es
# solo su respaldo, asi que un cambio de codigo no tiene por que costarle al
# cliente volver a bajar todos los renders.
$huella = New-Object Text.StringBuilder
foreach ($rel in ($pesados | Sort-Object)) {
  if ($rel -eq './') { continue }
  $f = Join-Path $root ($rel -replace '/', '\')
  if (Test-Path $f -PathType Leaf) {
    [void]$huella.Append($rel).Append(':').Append((Get-Item $f).Length).Append('|')
  }
}

$md5   = [Security.Cryptography.MD5]::Create()
$bytes = $md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($huella.ToString()))
$version = ([BitConverter]::ToString($bytes) -replace '-', '').Substring(0, 12).ToLower()

$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine('{')
[void]$sb.AppendLine('  "_readme": "Generado por tools/build-offline-list.ps1. NO editar a mano: se reescribe entero. Es la lista de archivos que la app guarda para andar sin internet.",')
[void]$sb.AppendLine(('  "version": "{0}",' -f $version))
[void]$sb.AppendLine('  "armazon": [')
[void]$sb.AppendLine((($armazon | ForEach-Object { '    "' + ($_ -replace '"','\"') + '"' }) -join ",`r`n"))
[void]$sb.AppendLine('  ],')
[void]$sb.AppendLine('  "pesados": [')
[void]$sb.AppendLine((($pesados | ForEach-Object { '    "' + ($_ -replace '"','\"') + '"' }) -join ",`r`n"))
[void]$sb.AppendLine('  ]')
[void]$sb.AppendLine('}')

$destino = Join-Path $root 'offline-files.json'
[IO.File]::WriteAllText($destino, $sb.ToString(), (New-Object Text.UTF8Encoding($false)))

# ---- 4. Informe -------------------------------------------------------------
function Peso-De {
  param([string[]]$Lista)
  $total = 0
  foreach ($rel in $Lista) {
    if ($rel -eq './') { continue }
    $f = Join-Path $root ($rel -replace '/', '\')
    if (Test-Path $f -PathType Leaf) { $total += (Get-Item $f).Length }
  }
  return $total
}

$pesoArmazon = Peso-De $armazon
$pesoPesados = Peso-De $pesados

Write-Host ""
Write-Host ("Version               : {0}" -f $version)
Write-Host ("Armazon (arranque)    : {0,4} archivos - {1,7:N1} MB" -f $armazon.Count, ($pesoArmazon / 1MB))
Write-Host ("Pesados (2do plano)   : {0,4} archivos - {1,7:N1} MB" -f $pesados.Count, ($pesoPesados / 1MB))
Write-Host ("TOTAL sin internet    : {0,4} archivos - {1,7:N1} MB" -f ($armazon.Count + $pesados.Count), (($pesoArmazon + $pesoPesados) / 1MB))
Write-Host ""
Write-Host "Escrito en offline-files.json"
