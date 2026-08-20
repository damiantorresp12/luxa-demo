# =============================================================================
# APLICAR MARCA - deja el showroom con la identidad del cliente
#
# Lee js/brand.config.js (el unico archivo que se edita por cliente) y genera
# las dos cosas que NO pueden leerse desde ahi en vivo, porque las necesita el
# sistema operativo antes de que la pagina arranque:
#
#   assets/icon-192.png            el icono comun
#   assets/icon-512.png            el icono grande (pantalla de inicio)
#   assets/icon-maskable-512.png   version con margen, para los telefonos
#                                  Android que recortan el icono en circulo
#   manifest.webmanifest           la ficha de instalacion: nombre, colores,
#                                  iconos y como se abre la app
#
# CUANDO CORRERLO: cada vez que cambies el nombre, la letra o el color en
# js/brand.config.js. Si no lo corres, la app se ve bien pero el icono y el
# nombre al instalar siguen siendo los anteriores.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\aplicar-marca.ps1
#
# Si el cliente tiene un logo propio en imagen, ponelo en brand.config.js
# (logo.image) y reemplaza estos iconos a mano por versiones de su logo.
#
# Nota: sin acentos a proposito - Windows PowerShell lee este archivo como ANSI.
# =============================================================================

param(
  [string]$Letra = '',
  [string]$Color = ''
)

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$config = Join-Path $root 'js\brand.config.js'

# ---- Leer la marca desde brand.config.js -----------------------------------
$Nombre  = ''
$Bajada  = ''
$Detalle = ''

if (Test-Path $config) {
  # -Encoding UTF8 es obligatorio: brand.config.js tiene acentos y sin esto
  # PowerShell lo lee como ANSI y la descripcion sale con simbolos rotos.
  $txt = Get-Content $config -Raw -Encoding UTF8
  if ($txt -match "name:\s*'([^']*)'") { $Nombre = $Matches[1] }
  if ($txt -match "\sby:\s*'([^']*)'") { $Bajada = $Matches[1] }
  if ($txt -match "description:\s*\{\s*es:\s*'([^']*)'") { $Detalle = $Matches[1] }
  if (-not $Letra) {
    if ($txt -match "mark:\s*'([^']+)'") { $Letra = $Matches[1] }
    elseif ($Nombre)                     { $Letra = $Nombre.Substring(0,1) }
  }
  if (-not $Color -and $txt -match "accent:\s*'(#[0-9A-Fa-f]{6})'") { $Color = $Matches[1] }
} else {
  Write-Host "AVISO: no encontre js\brand.config.js - uso los valores por defecto."
}

if (-not $Nombre) { $Nombre = 'Showroom' }
if (-not $Letra)  { $Letra  = $Nombre.Substring(0,1) }
if (-not $Color)  { $Color  = '#C9A24B' }

Write-Host ("Marca : {0}" -f $Nombre)
Write-Host ("        letra '{0}', color {1}" -f $Letra, $Color)
Write-Host ""

# ---- Colores ----------------------------------------------------------------
$claro  = [System.Drawing.ColorTranslator]::FromHtml($Color)
# El tono oscuro del degrade: el mismo color al 68 por ciento de brillo.
$oscuro = [System.Drawing.Color]::FromArgb(
            [int]($claro.R * 0.68), [int]($claro.G * 0.68), [int]($claro.B * 0.68))
$tinta  = [System.Drawing.ColorTranslator]::FromHtml('#08080A')

function Nuevo-Icono {
  param([int]$Lado, [string]$Salida, [double]$Margen = 0.0)

  $bmp = New-Object System.Drawing.Bitmap($Lado, $Lado)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  # Con margen (version maskable) el fondo ocupa todo y la letra va mas chica,
  # asi el recorte circular de Android no se come la letra.
  # OJO: PowerShell no distingue mayusculas en los nombres de variable, asi que
  # la medida interior NO puede llamarse $lado - pisaria al parametro $Lado.
  $pad      = [int]($Lado * $Margen)
  $interior = $Lado - ($pad * 2)

  $rect = New-Object System.Drawing.Rectangle(0, 0, $Lado, $Lado)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
             $rect, $claro, $oscuro, 45.0)

  if ($Margen -gt 0) {
    # Maskable: fondo completo, sin esquinas redondeadas (las pone el sistema)
    $g.FillRectangle($brush, $rect)
  } else {
    # Icono normal: cuadrado con esquinas redondeadas, igual que el del menu
    $r    = [int]($Lado * 0.1875)   # mismo radio proporcional que .brand-mark
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d    = $r * 2
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($Lado - $d, 0, $d, $d, 270, 90)
    $path.AddArc($Lado - $d, $Lado - $d, $d, $d, 0, 90)
    $path.AddArc(0, $Lado - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose()
  }

  # La letra, centrada
  $tam   = [float]($interior * 0.58)
  $fuente = New-Object System.Drawing.Font('Georgia', $tam,
              [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $tintaBrush = New-Object System.Drawing.SolidBrush($tinta)
  $cajaTexto  = New-Object System.Drawing.RectangleF($pad, $pad, $interior, $interior)
  $g.DrawString($Letra, $fuente, $tintaBrush, $cajaTexto, $fmt)

  $g.Dispose()
  $bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $brush.Dispose(); $fuente.Dispose(); $tintaBrush.Dispose()

  Write-Host ("  {0}  ({1} x {1}, {2:N0} KB)" -f (Split-Path $Salida -Leaf), $Lado, ((Get-Item $Salida).Length / 1KB))
}

$assets = Join-Path $root 'assets'
Write-Host "Iconos:"
Nuevo-Icono -Lado 192 -Salida (Join-Path $assets 'icon-192.png')
Nuevo-Icono -Lado 512 -Salida (Join-Path $assets 'icon-512.png')
Nuevo-Icono -Lado 512 -Salida (Join-Path $assets 'icon-maskable-512.png') -Margen 0.16

# ---- La ficha de instalacion (manifest) -------------------------------------
# El celular la lee ANTES de abrir la pagina, por eso no puede salir de
# brand.config.js en vivo: hay que dejarla escrita en un archivo.

function Esc-Json { param([string]$s) return ($s -replace '\\','\\' -replace '"','\"') }

$titulo = if ($Bajada) { "$Nombre - $Bajada" } else { $Nombre }
if (-not $Detalle) { $Detalle = $titulo }

$manifest = @"
{
  "name": "$(Esc-Json $titulo)",
  "short_name": "$(Esc-Json $Nombre)",
  "description": "$(Esc-Json $Detalle)",
  "lang": "es",
  "dir": "ltr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#08080A",
  "theme_color": "#08080A",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
"@

# Sin BOM: algunos navegadores se hacen los tontos con el manifest si lo tiene.
$destino = Join-Path $root 'manifest.webmanifest'
[IO.File]::WriteAllText($destino, $manifest, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Ficha de instalacion:"
Write-Host ("  manifest.webmanifest  (se instala como '{0}')" -f $Nombre)

Write-Host ""
Write-Host "Listo. Si cambiaste el nombre o el color, acordate de subir los cambios"
Write-Host "para que el showroom publicado tome el icono nuevo."
