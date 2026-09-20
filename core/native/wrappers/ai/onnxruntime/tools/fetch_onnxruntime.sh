#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/onnxruntime"
REF="v1.30.0"

if [[ -f "$VENDOR/include/onnxruntime/core/session/onnxruntime_c_api.h" ]]; then
  exit 0
fi

rm -rf "$VENDOR"
mkdir -p "$(dirname "$VENDOR")"
git clone --depth 1 --branch "$REF" --recurse-submodules --shallow-submodules \
  https://github.com/microsoft/onnxruntime.git "$VENDOR"
