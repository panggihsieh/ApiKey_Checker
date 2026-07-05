# Strix scan entrypoint

This directory contains this project's Strix scan configuration.

## Prerequisites

- Docker is installed and running.
- Strix is installed locally, or installed by GitHub Actions.
- `STRIX_LLM` and `LLM_API_KEY` are set in the environment.

Example:

```bash
export STRIX_LLM="openai/gpt-5.4"
export LLM_API_KEY="your-api-key"
```

PowerShell:

```powershell
$env:STRIX_LLM="openai/gpt-5.4"
$env:LLM_API_KEY="your-api-key"
```

## Local scan

Bash:

```bash
./design/scan/run-local.sh
```

PowerShell:

```powershell
.\design\scan\run-local.ps1
```

Set a different scan mode when needed:

```bash
SCAN_MODE=quick ./design/scan/run-local.sh
```

```powershell
$env:SCAN_MODE="quick"
.\design\scan\run-local.ps1
```

## CI

GitHub Actions installs Strix during the workflow and uses:

```bash
strix -n -t ./ --scan-mode quick --instruction-file ./design/scan/instructions.md
```

Add these repository secrets in GitHub:

- `STRIX_LLM`
- `LLM_API_KEY`
