$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not $env:STRIX_LLM) {
  throw 'Set STRIX_LLM first, for example: $env:STRIX_LLM="openai/gpt-5.4"'
}

if (-not $env:LLM_API_KEY) {
  throw 'Set LLM_API_KEY before running Strix'
}

$scanMode = if ($env:SCAN_MODE) { $env:SCAN_MODE } else { "standard" }

strix `
  -n `
  -t ./ `
  --scan-mode $scanMode `
  --instruction-file ./design/scan/instructions.md
