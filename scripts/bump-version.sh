#!/usr/bin/env bash
# bump-version.sh
# Bash equivalent of scripts/bump-version.ps1
#
# Bumps the semantic version in VERSION and backend/internal/version/version.go.
#
# Usage:
#   bash scripts/bump-version.sh [patch|minor|major] [--dry-run]
#
# Defaults:
#   part: patch

set -euo pipefail

PART="patch"
DRY_RUN=false
VERSION_FILE="VERSION"
GO_VERSION_FILE="backend/internal/version/version.go"

while [[ $# -gt 0 ]]; do
  case "$1" in
    patch|minor|major) PART="$1"; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --version-file) VERSION_FILE="$2"; shift 2 ;;
    --go-version-file) GO_VERSION_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; echo "Usage: $0 [patch|minor|major] [--dry-run]"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "Version file not found: $VERSION_FILE"
  exit 1
fi

if [[ ! -f "$GO_VERSION_FILE" ]]; then
  echo "Go version file not found: $GO_VERSION_FILE"
  exit 1
fi

CURRENT="$(cat "$VERSION_FILE" | tr -d '[:space:]')"

if [[ ! "$CURRENT" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Version '$CURRENT' is not valid semantic version text in MAJOR.MINOR.PATCH format."
  exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"

case "$PART" in
  major) NEXT="$((MAJOR + 1)).0.0" ;;
  minor) NEXT="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEXT="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac

if $DRY_RUN; then
  echo "WhatIf: version would be bumped from $CURRENT to $NEXT ($PART)."
  exit 0
fi

# Verify Version constant exists before modifying
if ! grep -qE 'const Version = "[0-9]+\.[0-9]+\.[0-9]+"' "$GO_VERSION_FILE"; then
  echo "Failed to locate Version constant in $GO_VERSION_FILE"
  exit 1
fi

# Atomic-style update: write temp files, then move both
VERSION_TMP="${VERSION_FILE}.tmp.$$"
GO_TMP="${GO_VERSION_FILE}.tmp.$$"

trap 'rm -f "$VERSION_TMP" "$GO_TMP"' EXIT

printf '%s\n' "$NEXT" > "$VERSION_TMP"
sed -E "s/const Version = \"[0-9]+\.[0-9]+\.[0-9]+\"/const Version = \"$NEXT\"/" "$GO_VERSION_FILE" > "$GO_TMP"

mv "$VERSION_TMP" "$VERSION_FILE"
mv "$GO_TMP" "$GO_VERSION_FILE"

echo "Version bumped from $CURRENT to $NEXT ($PART)."
