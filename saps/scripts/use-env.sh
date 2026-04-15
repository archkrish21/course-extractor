#!/usr/bin/env bash
# Switch the active .env.local between local dev and production configs.
# Usage: ./scripts/use-env.sh dev | prd

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  dev)
    cp "$DIR/.env.dev" "$DIR/.env.local"
    echo "Switched to dev environment"
    ;;
  prd)
    cp "$DIR/.env.prd" "$DIR/.env.local"
    echo "Switched to prd environment"
    ;;
  *)
    # Show which env is currently active
    if [ -f "$DIR/.env.local" ]; then
      if diff -q "$DIR/.env.local" "$DIR/.env.dev" &>/dev/null; then
        echo "Currently using: dev"
      elif diff -q "$DIR/.env.local" "$DIR/.env.prd" &>/dev/null; then
        echo "Currently using: prd"
      else
        echo "Currently using: unknown (modified)"
      fi
    else
      echo "No .env.local found"
    fi
    echo "Usage: ./scripts/use-env.sh [dev|prd]"
    ;;
esac
