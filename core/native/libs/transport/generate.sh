#!/usr/bin/env bash
# Generate C++ code from Cap'n Proto schema.
# Run once after installing capnproto: sudo pacman -S capnproto
# Then commit src/storage/generated/ into the repo.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CAPNP_BIN="${CAPNP:-capnp}"
CAPNPC_CXX_BIN="${CAPNPC_CXX:-capnpc-c++}"
REQUIRED_VERSION="1.2.0"

if ! command -v "$CAPNP_BIN" &>/dev/null; then
  echo "ERROR: capnp not found. Set CAPNP=/path/to/capnp or install capnproto ${REQUIRED_VERSION}" >&2
  exit 1
fi

VERSION_OUTPUT="$("$CAPNP_BIN" --version)"
echo "capnp ${VERSION_OUTPUT}"
if [[ "$VERSION_OUTPUT" != *" ${REQUIRED_VERSION}" ]]; then
  echo "ERROR: capnp ${REQUIRED_VERSION} is required to match vendored runtime" >&2
  echo "       build/use vendor/capnproto/c++ tools and set CAPNP/CAPNPC_CXX if needed" >&2
  exit 1
fi

cd "$SCRIPT_DIR"

"$CAPNP_BIN" compile \
  -o"$CAPNPC_CXX_BIN" \
  --src-prefix=schema/storage \
  -I schema/storage \
  schema/storage/wire.capnp

if [[ -f wire.capnp.h && -f wire.capnp.c++ ]]; then
  mv wire.capnp.h   src/storage/generated/wire.capnp.h
  mv wire.capnp.c++ src/storage/generated/wire.capnp.cpp
elif [[ -f schema/storage/wire.capnp.h && -f schema/storage/wire.capnp.c++ ]]; then
  mv schema/storage/wire.capnp.h   src/storage/generated/wire.capnp.h
  mv schema/storage/wire.capnp.c++ src/storage/generated/wire.capnp.cpp
else
  echo "ERROR: capnp generated files were not found" >&2
  exit 1
fi

echo "Generated:"
echo "  src/storage/generated/wire.capnp.h"
echo "  src/storage/generated/wire.capnp.cpp"
