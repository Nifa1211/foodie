#!/usr/bin/env bash
# Redeploy after you change code (this is the "CD" step for the local cluster).
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/start.sh
