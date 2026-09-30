#!/usr/bin/env bash
set -euo pipefail

# Run the production Express server, which serves the React build when present.
# Build first with: npm --prefix contact-agent/backend run build
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/contact-agent/backend"
exec npm start
