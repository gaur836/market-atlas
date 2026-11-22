$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\") + "\"
$prefix = "http://localhost:8766/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Could not start Market Atlas at $prefix. Close any process using port 8766 and try again. $($_.Exception.Message)"
    exit 1
}

Write-Host "Market Atlas is running at $prefix"
Write-Host "Keep this window open while using the app. Press Ctrl+C to stop the local server."
Start-Process $prefix

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response

        try {
            if ($context.Request.HttpMethod -ne "GET" -and $context.Request.HttpMethod -ne "HEAD") {
                $response.StatusCode = 405
                $response.Close()
                continue
            }

            $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = "index.html"
            }

            $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
            if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
                $response.Close()
                continue
            }
            if (-not [System.IO.File]::Exists($filePath)) {
                $response.StatusCode = 404
                $response.Close()
                continue
            }

            $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
            switch ($extension) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                default { $response.ContentType = "application/octet-stream" }
            }

            $response.Headers["Cache-Control"] = "no-store"
            $response.Headers["X-Content-Type-Options"] = "nosniff"
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            if ($context.Request.HttpMethod -eq "GET") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            $response.Close()
        } catch {
            $response.StatusCode = 500
            $response.Close()
            Write-Warning "A local request failed: $($_.Exception.Message)"
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
