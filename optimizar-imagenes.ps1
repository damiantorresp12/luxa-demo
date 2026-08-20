# =============================================================================
# LUXA - Optimizar imagenes para la app
#
# Los renders salen enormes: hay imagenes de ambiente de mas de 3 MB. La app
# las muestra a 300px en una card y a pantalla completa en un ambiente, asi
# que el cliente descarga mucho mas detalle del que la pantalla puede mostrar.
# En el 4G de una reunion eso son decenas de segundos de espera.
#
# Este script deja copias livianas EN EL MISMO LUGAR, con el mismo nombre, y
# guarda los originales intactos en assets\_originales\ (fuera del respaldo).
# La app no se entera: sigue pidiendo las mismas rutas.
#
#   Fotos de producto : max 1200px, calidad 80   (assets\Imagenes)
#   Fotos de ambiente : max 1800px, calidad 82   (assets\Spaces)
#
# NO toca los videos de transicion ni la carpeta _trash ni _originales.
#
# Uso:
#   .\optimizar-imagenes.ps1              hace el trabajo
#   .\optimizar-imagenes.ps1 -Simular     solo informa, no toca nada
#
# Nota: sin acentos ni simbolos raros a proposito. Windows PowerShell lee este
# archivo como ANSI y cualquier caracter especial le rompe el parseo.
# =============================================================================

param(
  [switch]$Simular,
  [int]$MaxProducto = 1200,
  [int]$MaxAmbiente = 1800
)

Add-Type -AssemblyName System.Drawing

$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupDir = Join-Path $root 'assets\_originales'

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
             Where-Object { $_.MimeType -eq 'image/jpeg' }

function Optimizar {
  param([string]$Ruta, [int]$MaxLado, [int]$Calidad, [bool]$SoloSimular)

  $info  = Get-Item $Ruta
  $bytes = [IO.File]::ReadAllBytes($Ruta)
  $ms    = New-Object IO.MemoryStream(,$bytes)
  $img   = [System.Drawing.Image]::FromStream($ms)
  $w = $img.Width; $h = $img.Height

  $escala = [Math]::Min(1.0, $MaxLado / [double]([Math]::Max($w, $h)))
  $nw = [int][Math]::Round($w * $escala)
  $nh = [int][Math]::Round($h * $escala)

  # Redibujar siempre: aunque no haya que achicar, re-comprimir a calidad 80
  # baja mucho el peso de los PNG y de los JPG exportados sin comprimir.
  $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  # Fondo blanco: si el original tenia transparencia queda igual que el resto
  # de los renders, que vienen sobre blanco.
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose()

  $eps = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $eps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                    [System.Drawing.Imaging.Encoder]::Quality, [long]$Calidad)

  $tmp = [IO.Path]::GetTempFileName()
  $bmp.Save($tmp, $jpegCodec, $eps)
  $bmp.Dispose(); $img.Dispose(); $ms.Dispose()

  $nuevoPeso = (Get-Item $tmp).Length
  $mejora    = $nuevoPeso -lt $info.Length

  $resultado = [pscustomobject]@{
    Archivo   = $info.FullName.Substring($root.Length + 1)
    AntesKB   = [int]($info.Length / 1KB)
    DespuesKB = [int]($nuevoPeso / 1KB)
    Antes     = ("{0} x {1}" -f $w, $h)
    Despues   = ("{0} x {1}" -f $nw, $nh)
    Aplicado  = $false
  }

  # Si la copia no mejora nada, se descarta y el original queda como esta.
  if (-not $mejora) { Remove-Item $tmp -Force; return $resultado }

  if ($SoloSimular) { Remove-Item $tmp -Force; return $resultado }

  $rel     = $info.FullName.Substring((Join-Path $root 'assets').Length + 1)
  $destino = Join-Path $backupDir $rel
  New-Item -ItemType Directory -Force (Split-Path $destino -Parent) | Out-Null
  Move-Item $info.FullName $destino -Force
  Move-Item $tmp $info.FullName -Force
  $resultado.Aplicado = $true
  return $resultado
}

# Las carpetas que empiezan con guion bajo quedan afuera: _trash guarda las
# fotos que borraste y _originales es el respaldo que crea este mismo script.
$objetivos = @()
$objetivos += Get-ChildItem (Join-Path $root 'assets\Imagenes') -Recurse -File |
              Where-Object { $_.Extension -match '^\.(jpe?g|png)$' -and $_.FullName -notmatch '\\_' } |
              ForEach-Object { [pscustomobject]@{ Ruta = $_.FullName; Max = $MaxProducto; Q = 80 } }
$objetivos += Get-ChildItem (Join-Path $root 'assets\Spaces') -Recurse -File |
              Where-Object { $_.Extension -match '^\.(jpe?g|png)$' -and $_.FullName -notmatch '\\_' } |
              ForEach-Object { [pscustomobject]@{ Ruta = $_.FullName; Max = $MaxAmbiente; Q = 82 } }

if ($Simular) { Write-Host "MODO SIMULACION - no se toca ningun archivo" }
Write-Host ("Procesando {0} imagenes..." -f $objetivos.Count)

$res = foreach ($o in $objetivos) {
  Optimizar -Ruta $o.Ruta -MaxLado $o.Max -Calidad $o.Q -SoloSimular:$Simular.IsPresent
}

$antes     = ($res | Measure-Object AntesKB -Sum).Sum
$despues   = ($res | ForEach-Object { if ($_.DespuesKB -lt $_.AntesKB) { $_.DespuesKB } else { $_.AntesKB } } |
              Measure-Object -Sum).Sum
$cambiadas = ($res | Where-Object { $_.DespuesKB -lt $_.AntesKB }).Count
$pct       = [int]((1 - ($despues / [double]$antes)) * 100)

Write-Host ""
Write-Host ("Imagenes optimizadas : {0} de {1}" -f $cambiadas, $res.Count)
Write-Host ("Peso antes           : {0:N1} MB" -f ($antes / 1KB))
Write-Host ("Peso despues         : {0:N1} MB" -f ($despues / 1KB))
Write-Host ("Ahorro               : {0:N1} MB / {1} por ciento menos" -f (($antes - $despues) / 1KB), $pct)
if (-not $Simular) {
  Write-Host ""
  Write-Host "Los originales quedaron en assets\_originales\ - no se borro nada."
}
