# =====================================================================
# Haryana Cyber Police - Localhost Web Server
# Serves the portal on http://localhost:8080/
# =====================================================================

$port = 8080
$folder = $PSScriptRoot
if (-not $folder) { $folder = "c:\Users\ALTGR\Downloads\LEAVES" }

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "       HARYANA POLICE - STATE CYBER CRIME, PANCHKULA" -ForegroundColor Yellow
Write-Host "     Online Leave Management System - Localhost Web Server" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Localhost URL: http://localhost:$port/" -ForegroundColor Green
Write-Host "IP Loopback:   http://127.0.0.1:$port/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl + C in this window to stop the server." -ForegroundColor Gray
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Port $port busy, trying 8085..." -ForegroundColor Yellow
    $port = 8085
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}

Write-Host "Server is running successfully at http://localhost:$port/" -ForegroundColor Green

# Open browser to localhost URL
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath) -or $urlPath -eq "/") { $urlPath = "index.html" }

        $filePath = Join-Path $folder $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".svg"  { "image/svg+xml" }
                ".png"  { "image/png" }
                ".json" { "application/json" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
        }

        $response.Close()
    } catch {
        # Handle client disconnect gracefully
    }
}
