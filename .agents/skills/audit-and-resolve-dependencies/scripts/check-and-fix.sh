#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_DIR"

echo "==> Checking npm security vulnerabilities in $REPO_DIR..."

if npm audit; then
  echo "==> 0 vulnerabilities detected."
else
  echo "==> Vulnerabilities found. Attempting automatic fix..."
  npm audit fix || true

  echo "==> Re-auditing dependencies..."
  if ! npm audit; then
    echo "==> Notice: Remaining vulnerabilities require overrides or manual package adjustments."
    exit 1
  fi
fi

echo "==> Running build verification (tsc -b && vite build)..."
npm run build

echo "==> Audit and build verification completed successfully!"
