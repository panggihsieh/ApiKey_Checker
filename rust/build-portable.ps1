$ErrorActionPreference = "Stop"

$rustRoot = $PSScriptRoot
$version = (Get-Content -Raw (Join-Path $rustRoot "package.json") | ConvertFrom-Json).version
$bundleDir = Join-Path $rustRoot "target\release\bundle\portable"
$binary = Join-Path $rustRoot "target\release\api-key-checker-tauri.exe"
$output = Join-Path $bundleDir "API-Key-Checker-$version-rust-windows-x64-portable.exe"

cargo build -p api-key-checker-tauri --release --manifest-path (Join-Path $rustRoot "Cargo.toml")
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

New-Item -ItemType Directory -Force $bundleDir | Out-Null
Copy-Item -LiteralPath $binary -Destination $output -Force
Write-Host "Built $output"
