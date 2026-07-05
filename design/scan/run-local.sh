#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

: "${STRIX_LLM:?Set STRIX_LLM, for example: export STRIX_LLM=\"openai/gpt-5.4\"}"
: "${LLM_API_KEY:?Set LLM_API_KEY before running Strix}"

SCAN_MODE="${SCAN_MODE:-standard}"

strix \
  -n \
  -t ./ \
  --scan-mode "$SCAN_MODE" \
  --instruction-file ./design/scan/instructions.md
