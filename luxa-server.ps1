param([int]$Port = 8080)

$root   = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.htm'   = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'application/javascript; charset=utf-8'
  '.mjs'   = 'application/javascript; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.webp'  = 'image/webp'
  '.ico'   = 'image/x-icon'
  '.woff'  = 'font/woff'
  '.woff2' = 'font/woff2'
  '.ttf'   = 'font/ttf'
  '.otf'   = 'font/otf'
  '.txt'   = 'text/plain; charset=utf-8'
  '.glb'   = 'model/gltf-binary'
  '.gltf'  = 'model/gltf+json'
  '.mp4'   = 'video/mp4'
  '.webm'  = 'video/webm'
  '.mp3'   = 'audio/mpeg'
  '.pdf'   = 'application/pdf'
  '.xlsx'  = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  '.map'   = 'application/json; charset=utf-8'
}

# =============================================================================
# Mini-API for the Product Data Generator
#   GET  /__list?path=<rel>    → JSON list of files in folder (whitelisted)
#   POST /__save?path=<rel>    → writes request body to file (whitelisted, auto-backup)
#   POST /__upload?path=<rel>  → writes raw request body as binary file (whitelisted to assets/)
# =============================================================================
$listAllowedPrefixes   = @('assets/', 'space-planner/catalogs/', 'space-planner/')
$saveAllowedPrefixes   = @('space-planner/catalogs/')
$uploadAllowedPrefixes = @('assets/Imagenes/', 'assets/Spaces/')

function Send-Json {
  param($response, [int]$statusCode, $obj)
  $response.StatusCode = $statusCode
  $response.ContentType = 'application/json; charset=utf-8'
  $response.Headers['Cache-Control'] = 'no-store'
  $json = ConvertTo-Json $obj -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Resolve-SafePath {
  param([string]$rel, [string[]]$allowedPrefixes, [string]$rootResolved, [string]$root)
  if (-not $rel) { return $null }
  $normalized = $rel.Replace('\','/').TrimStart('/')
  if ($normalized -match '\.\.') { return $null }
  $okPrefix = $false
  foreach ($p in $allowedPrefixes) {
    if ($normalized.StartsWith($p, [StringComparison]::OrdinalIgnoreCase)) { $okPrefix = $true; break }
  }
  if (-not $okPrefix) { return $null }
  try { $full = [System.IO.Path]::GetFullPath((Join-Path $root $normalized)) } catch { return $null }
  if (-not $full.StartsWith($rootResolved, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  return $full
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "ERROR: no se pudo iniciar el servidor en $prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Posibles causas: el puerto 8080 ya esta en uso, o el firewall lo bloquea."
  Read-Host "Presiona Enter para cerrar"
  exit 1
}

Write-Host "Servidor activo en $prefix" -ForegroundColor Green
Write-Host "Sirviendo: $root"
Write-Host ""

$rootResolved = [System.IO.Path]::GetFullPath($root)

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $status = 200

    try {
      $absPath = $req.Url.AbsolutePath

      # ----- API: list directory -----
      if ($absPath -eq '/__list' -and $req.HttpMethod -eq 'GET') {
        $qpath = $req.QueryString['path']
        $safe = Resolve-SafePath $qpath $listAllowedPrefixes $rootResolved $root
        if (-not $safe) {
          $status = 400
          Send-Json $res 400 @{ ok = $false; error = 'invalid or not-allowed path'; path = $qpath }
        } elseif (-not (Test-Path $safe -PathType Container)) {
          $status = 404
          Send-Json $res 404 @{ ok = $false; error = 'folder not found'; path = $qpath }
        } else {
          $files = @(Get-ChildItem $safe -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name | Sort-Object)
          $dirs  = @(Get-ChildItem $safe -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name | Sort-Object)
          Send-Json $res 200 @{ ok = $true; path = $qpath; files = $files; folders = $dirs }
        }
      }
      # ----- API: save file -----
      elseif ($absPath -eq '/__save' -and $req.HttpMethod -eq 'POST') {
        $qpath = $req.QueryString['path']
        $safe = Resolve-SafePath $qpath $saveAllowedPrefixes $rootResolved $root
        if (-not $safe -or -not $safe.ToLower().EndsWith('.json')) {
          $status = 400
          Send-Json $res 400 @{ ok = $false; error = 'invalid, not-allowed or non-json path'; path = $qpath }
        } else {
          $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
          $body = $reader.ReadToEnd()
          $reader.Close()
          if ([string]::IsNullOrWhiteSpace($body)) {
            $status = 400
            Send-Json $res 400 @{ ok = $false; error = 'empty body' }
          } else {
            $jsonValid = $true
            try { $null = ConvertFrom-Json $body -ErrorAction Stop } catch {
              $jsonValid = $false
              $status = 400
              Send-Json $res 400 @{ ok = $false; error = ('body is not valid JSON: ' + $_.Exception.Message) }
            }
            if ($jsonValid) {
              $backupPath = $null
              if (Test-Path $safe -PathType Leaf) {
                $backupPath = "$safe.bak.json"
                Copy-Item $safe $backupPath -Force
              }
              $parentDir = Split-Path -Parent $safe
              if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
              [System.IO.File]::WriteAllText($safe, $body, [System.Text.UTF8Encoding]::new($false))
              Send-Json $res 200 @{ ok = $true; path = $qpath; bytes = $body.Length; backupPath = $backupPath }
            }
          }
        }
      }
      # ----- API: upload binary file -----
      elseif ($absPath -eq '/__upload' -and $req.HttpMethod -eq 'POST') {
        $qpath = $req.QueryString['path']
        $safe = Resolve-SafePath $qpath $uploadAllowedPrefixes $rootResolved $root
        if (-not $safe) {
          $status = 400
          Send-Json $res 400 @{ ok = $false; error = 'invalid or not-allowed path'; path = $qpath }
        } else {
          $parentDir = Split-Path -Parent $safe
          if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
          # Avoid clobber: if a file with this name already exists, append _2, _3, ...
          $finalPath = $safe
          if (Test-Path $finalPath -PathType Leaf) {
            $dir = Split-Path -Parent $finalPath
            $base = [System.IO.Path]::GetFileNameWithoutExtension($finalPath)
            $ext = [System.IO.Path]::GetExtension($finalPath)
            $n = 2
            while (Test-Path (Join-Path $dir ("{0}_{1}{2}" -f $base, $n, $ext))) { $n++ }
            $finalPath = Join-Path $dir ("{0}_{1}{2}" -f $base, $n, $ext)
          }
          $len = [int]$req.ContentLength64
          if ($len -le 0) {
            $status = 400
            Send-Json $res 400 @{ ok = $false; error = 'empty body or missing Content-Length' }
          } else {
            try {
              # Read the request body to memory (images are small enough for that to be fine)
              $ms = New-Object IO.MemoryStream
              $req.InputStream.CopyTo($ms)
              $bytes = $ms.ToArray()
              $ms.Close()
              [System.IO.File]::WriteAllBytes($finalPath, $bytes)
              Send-Json $res 200 @{
                ok = $true
                path = $qpath
                savedAs = (Split-Path -Leaf $finalPath)
                bytes = $bytes.Length
              }
            } catch {
              $status = 500
              Send-Json $res 500 @{ ok = $false; error = ('write failed: ' + $_.Exception.Message) }
            }
          }
        }
      }
      # ----- Static file serving (default) -----
      else {

      $relPath = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($relPath)) { $relPath = 'index.html' }
      $fullPath = Join-Path $root $relPath

      if (Test-Path $fullPath -PathType Container) {
        $fullPath = Join-Path $fullPath 'index.html'
      }

      $resolved = [System.IO.Path]::GetFullPath($fullPath)

      if (-not $resolved.StartsWith($rootResolved, [StringComparison]::OrdinalIgnoreCase)) {
        $status = 403
        $res.StatusCode = 403
        $msg = [Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      } elseif (Test-Path $resolved -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = 'application/octet-stream' }
        $res.ContentType = $ct
        $res.Headers['Cache-Control'] = 'no-store'
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $status = 404
        $res.StatusCode = 404
        $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
      } # end static-serve else
    } catch {
      $status = 500
      try {
        $res.StatusCode = 500
        $msg = [Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: " + $_.Exception.Message)
        $res.OutputStream.Write($msg, 0, $msg.Length)
      } catch {}
    } finally {
      try { $res.Close() } catch {}
      $color = if ($status -ge 400) { 'Yellow' } else { 'Gray' }
      Write-Host ("{0,3} {1} {2}" -f $status, $req.HttpMethod, $req.Url.AbsolutePath) -ForegroundColor $color
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
