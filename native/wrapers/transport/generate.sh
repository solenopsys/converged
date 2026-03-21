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

if [[ -f wire.capnp.h && -f wire.capnp.c++ ]]; then
  mv wire.capnp.h   src/generated/wire.capnp.h
  mv wire.capnp.c++ src/generated/wire.capnp.cpp
elif [[ -f schema/wire.capnp.h && -f schema/wire.capnp.c++ ]]; then
  mv schema/wire.capnp.h   src/generated/wire.capnp.h
  mv schema/wire.capnp.c++ src/generated/wire.capnp.cpp
else
  echo "ERROR: capnp generated files were not found" >&2
  exit 1
fi

echo "Generated:"
echo "  src/generated/wire.capnp.h"
echo "  src/generated/wire.capnp.cpp"
