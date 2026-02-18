#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <work-dir>"
  exit 1
fi

WORK_DIR="$1"
SRC_DIR="$WORK_DIR/cppagent"
BUILD_DIR="$SRC_DIR/build"

mkdir -p "$WORK_DIR"

if [[ ! -d "$SRC_DIR/.git" ]]; then
  git clone --depth 1 https://github.com/mtconnect/cppagent.git "$SRC_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build . --config Release --target agent -j"$(nproc)"

echo "Built cppagent binary:"
echo "  $BUILD_DIR/agent/agent"
