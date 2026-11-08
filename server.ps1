# QuickExam LAN HTTP Server Launcher
param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$DistDir = Join-Path $PSScriptRoot "dist"

if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
    Write-Host "Building production bundle..." -ForegroundColor Cyan
    Push-Location $PSScriptRoot
    & npm.cmd run build
    Pop-Location
}

$env:PORT = $Port
& node (Join-Path $PSScriptRoot "server.mjs")
