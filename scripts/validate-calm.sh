#!/usr/bin/env bash

set -euo pipefail

MODE="strict"
if [[ "${1:-}" == "--warn" ]]; then
  MODE="warn"
fi

MODEL_GLOB="docs/architecture-as-code/models/*.architecture.json"

shopt -s nullglob
models=($MODEL_GLOB)
shopt -u nullglob

if [[ ${#models[@]} -eq 0 ]]; then
  echo "No CALM model files found at $MODEL_GLOB"
  exit 0
fi

errors=0

for model in "${models[@]}"; do
  echo "Validating CALM model: $model"
  if ! npx --yes @finos/calm-cli validate -a "$model"; then
    errors=$((errors + 1))
  fi
done

if [[ $errors -gt 0 ]]; then
  if [[ "$MODE" == "warn" ]]; then
    echo "WARN: CALM validation reported $errors failing model(s); continuing in warn mode."
    exit 0
  fi

  echo "ERROR: CALM validation failed for $errors model(s)."
  exit 1
fi

echo "CALM validation passed for all model files."
