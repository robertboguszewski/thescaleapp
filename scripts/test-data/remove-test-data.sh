#!/bin/bash
# ============================================
# Xiaomi Scale Test Data Remover
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Run the TypeScript generator with remove flag
npx ts-node "$SCRIPT_DIR/generator.ts" --remove
