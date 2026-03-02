#!/usr/bin/env bash
# Generate C++ code from Cap'n Proto schema.
# Run once after installing capnproto: sudo pacman -S capnproto
# Then commit src/generated/ into the repo.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v capnp &>/dev/null; then
  echo "ERROR: capnp not found. Install with: sudo pacman -S capnproto" >&2
  exit 1
fi

echo "capnp $(capnp --version)"

cd "$SCRIPT_DIR"

capnp compile \
  -oc++ \
  --src-prefix=schema \
  -I schema \
  schema/wire.capnp

mv schema/wire.capnp.h   src/generated/wire.capnp.h
mv schema/wire.capnp.c++ src/generated/wire.capnp.cpp

echo "Generated:"
echo "  src/generated/wire.capnp.h"
echo "  src/generated/wire.capnp.cpp"
