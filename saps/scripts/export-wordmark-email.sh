#!/usr/bin/env bash
# Regenerate public/brand/wordmark-email.png from its SVG source.
#
# Email templates (Resend + Supabase Auth) embed the wordmark as a raster
# image because Outlook, iOS Mail, and Yahoo strip inline SVG. Re-run this
# whenever public/brand/wordmark-email.svg changes.
#
# Dependency: rsvg-convert (brew install librsvg)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAPS_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$SAPS_DIR/public/brand/wordmark-email.svg"
OUT="$SAPS_DIR/public/brand/wordmark-email.png"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "error: rsvg-convert not found. Install with: brew install librsvg" >&2
  exit 1
fi

rsvg-convert --width=520 --background-color='#6B1F3D' "$SRC" --output "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
