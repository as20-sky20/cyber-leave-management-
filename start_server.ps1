# =====================================================================
# Haryana Cyber Police - Localhost & LAN Web Server
# State Cyber Crime, Panchkula (Haryana)
# Ultra-lightweight socket HTTP server with shared database sync
# 100% Offline & works on all Windows PCs without Administrator privileges
# =====================================================================

$port = 8085
$folder = $PSScriptRoot
if (-not $folder) { $folder = "c:\Users\ALTGR\Downloads\LEAVES" }

# Detect Local Machine LAN IPv4 Address
$lanIP = ""
try {
    $ipAddresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { 
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and 
        !$_.ToString().StartsWith("127.") -and 
        !$_.ToString().StartsWith("169.254.")
    }
    if ($ipAddresses) {
        $lanIP = $ipAddresses[0].ToString()
    }
} catch {
    $lanIP = ""
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "       HARYANA POLICE - STATE CYBER CRIME, PANCHKULA" -ForegroundColor Yellow
Write-Host "     Online Leave Management System - Office LAN Server" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "इस कंप्यूटर पर (Localhost):" -ForegroundColor White
Write-Host "  -> http://localhost:$port/" -ForegroundColor Green
Write-Host "  -> http://127.0.0.1:$port/" -ForegroundColor Green
if ($lanIP) {
    Write-Host ""
    Write-Host "साइबर ऑफिस के अन्य कंप्यूटरों हेतु (Office LAN Sharing):" -ForegroundColor Yellow
    Write-Host "  -> http://${lanIP}:${port}/" -ForegroundColor Cyan
    Write-Host "  (कार्यालय के किसी भी कंप्यूटर पर यह लिंक खोलकर सभी जवान व अधिकारी जुड़ सकते हैं)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "डेटाबेस: $folder\database.json (ऑफिस शेयर्ड डेटाबेस सक्रिय)" -ForegroundColor Magenta
Write-Host "Press Ctrl + C in this window to stop the server." -ForegroundColor Gray
Write-Host ""

# Bind TcpListener to Any (0.0.0.0) so localhost AND LAN IP both work automatically!
$listener = $null
try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
    $listener.Start()
} catch {
    Write-Host "Port $port busy, trying 8085..." -ForegroundColor Yellow
    $port = 8085
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
    $listener.Start()
}

Write-Host "Server is running successfully at http://localhost:$port/" -ForegroundColor Green
if ($lanIP) {
    Write-Host "LAN URL: http://${lanIP}:${port}/" -ForegroundColor Cyan
}

try {
    Start-Process "http://localhost:$port/"
} catch {}

$dbPath = Join-Path $folder "database.json"

function Get-MimeType($filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".htm"  { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

while ($true) {
    $client = $null
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)

        $requestLine = $reader.ReadLine()
        if (-not $requestLine) {
            $client.Close()
            continue
        }

        $parts = $requestLine -split " "
        if ($parts.Length -lt 2) {
            $client.Close()
            continue
        }

        $httpMethod = $parts[0]
        $rawUrl = $parts[1]
        $pathOnly = $rawUrl.Split('?')[0]

        # Read Headers
        $contentLength = 0
        while ($true) {
            $headerLine = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($headerLine)) { break }
            if ($headerLine -match '^Content-Length:\s*(\d+)') {
                $contentLength = [int]$matches[1]
            }
        }

        # Read Body for POST
        $body = ""
        if ($contentLength -gt 0) {
            $buffer = New-Object char[] $contentLength
            $readTotal = 0
            while ($readTotal -lt $contentLength) {
                $read = $reader.Read($buffer, $readTotal, $contentLength - $readTotal)
                if ($read -le 0) { break }
                $readTotal += $read
            }
            $body = -join $buffer
        }

        # Handle Preflight OPTIONS
        if ($httpMethod -eq "OPTIONS") {
            $respHeader = "HTTP/1.1 200 OK`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                          "Access-Control-Allow-Headers: Content-Type, Cache-Control`r`n" +
                          "Content-Length: 0`r`n`r`n"
            $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
            $stream.Write($hdrBytes, 0, $hdrBytes.Length)
            $stream.Flush()
            $client.Close()
            continue
        }

        # API: GET /api/data
        if ($pathOnly -eq "/api/data" -and $httpMethod -eq "GET") {
            $jsonStr = ""
            if (Test-Path $dbPath -PathType Leaf) {
                $jsonStr = [System.IO.File]::ReadAllText($dbPath, [System.Text.Encoding]::UTF8)
            } else {
                $jsonStr = '{"exists":false}'
            }
            $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
            $respHeader = "HTTP/1.1 200 OK`r`n" +
                          "Content-Type: application/json; charset=utf-8`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Cache-Control: no-cache, no-store, must-revalidate`r`n" +
                          "Content-Length: $($jsonBytes.Length)`r`n`r`n"
            $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
            $stream.Write($hdrBytes, 0, $hdrBytes.Length)
            $stream.Write($jsonBytes, 0, $jsonBytes.Length)
            $stream.Flush()
            $client.Close()
            continue
        }

        # API: POST /api/save
        if ($pathOnly -eq "/api/save" -and $httpMethod -eq "POST") {
            if ($body) {
                [System.IO.File]::WriteAllText($dbPath, $body, [System.Text.Encoding]::UTF8)
                $reply = '{"success":true,"message":"डेटाबेस सुरक्षित किया गया"}'
                $replyBytes = [System.Text.Encoding]::UTF8.GetBytes($reply)
                $respHeader = "HTTP/1.1 200 OK`r`n" +
                              "Content-Type: application/json; charset=utf-8`r`n" +
                              "Access-Control-Allow-Origin: *`r`n" +
                              "Content-Length: $($replyBytes.Length)`r`n`r`n"
                $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
                $stream.Write($hdrBytes, 0, $hdrBytes.Length)
                $stream.Write($replyBytes, 0, $replyBytes.Length)
            } else {
                $reply = '{"success":false,"message":"रिक्त डेटा"}'
                $replyBytes = [System.Text.Encoding]::UTF8.GetBytes($reply)
                $respHeader = "HTTP/1.1 400 Bad Request`r`n" +
                              "Content-Type: application/json; charset=utf-8`r`n" +
                              "Access-Control-Allow-Origin: *`r`n" +
                              "Content-Length: $($replyBytes.Length)`r`n`r`n"
                $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
                $stream.Write($hdrBytes, 0, $hdrBytes.Length)
                $stream.Write($replyBytes, 0, $replyBytes.Length)
            }
            $stream.Flush()
            $client.Close()
            continue
        }

        # Static File Serving
        $cleanPath = $pathOnly.TrimStart('/')
        if ([string]::IsNullOrEmpty($cleanPath)) { $cleanPath = "index.html" }
        $cleanPath = $cleanPath -replace '/', '\'
        $filePath = Join-Path $folder $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $mime = Get-MimeType $filePath
            $respHeader = "HTTP/1.1 200 OK`r`n" +
                          "Content-Type: $mime`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Content-Length: $($fileBytes.Length)`r`n`r`n"
            $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
            $stream.Write($hdrBytes, 0, $hdrBytes.Length)
            $stream.Write($fileBytes, 0, $fileBytes.Length)
        } else {
            $notFound = "<h1>404 Not Found</h1><p>हरियाणा साइबर पुलिस पोर्टल - फाइल नहीं मिली</p>"
            $nfBytes = [System.Text.Encoding]::UTF8.GetBytes($notFound)
            $respHeader = "HTTP/1.1 404 Not Found`r`n" +
                          "Content-Type: text/html; charset=utf-8`r`n" +
                          "Access-Control-Allow-Origin: *`r`n" +
                          "Content-Length: $($nfBytes.Length)`r`n`r`n"
            $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($respHeader)
            $stream.Write($hdrBytes, 0, $hdrBytes.Length)
            $stream.Write($nfBytes, 0, $nfBytes.Length)
        }
        $stream.Flush()
        $client.Close()
    } catch {
        if ($client) { try { $client.Close() } catch {} }
    }
}
