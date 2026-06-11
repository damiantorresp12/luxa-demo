# =============================================================================
# LUXA - Mini servidor estatico (PowerShell HttpListener).
# Sirve la raiz del proyecto. Uso local sin Python/Node.
#   powershell -ExecutionPolicy Bypass -File tools/serve.ps1 [-Port 8123]
# =============================================================================
param([int]$Port = 8123)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$mime = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.js'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.svg'='image/svg+xml';
  '.pdf'='application/pdf'; '.ico'='image/x-icon'; '.webp'='image/webp'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "LUXA serving $root at http://localhost:$Port/"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $reqPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($reqPath -eq '/' -or $reqPath -eq '') { $reqPath = '/index.html' }
    $full = Join-Path $root ($reqPath.TrimStart('/').Replace('/', '\'))

    if (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ctx.Response.ContentType = $ct
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $reqPath")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    # cliente desconectado u otro error transitorio: seguir sirviendo
  }
}
