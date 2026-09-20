#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?target is required, e.g. x86_64-linux-musl}"
OPTIMIZE="${2:-ReleaseFast}"
PREFIX="${3:-zig-out}"
BUILD="$ROOT/.zig-cache/onnxruntime/$TARGET/$OPTIMIZE"
OUT="$ROOT/$PREFIX/$TARGET"

case "$TARGET" in
  x86_64-linux-gnu|x86_64-linux-musl|aarch64-linux-gnu|aarch64-linux-musl) ;;
  *) echo "unsupported target: $TARGET" >&2; exit 2 ;;
esac
PROCESSOR="${TARGET%%-*}"
CMAKE_BUILD_TYPE=Release
if [[ "$OPTIMIZE" == Debug ]]; then
  CMAKE_BUILD_TYPE=Debug
fi

if [[ "$TARGET" == *-musl && "${ORT_MUSL_IN_CONTAINER:-0}" != 1 && ! -f /etc/alpine-release ]]; then
  exec "$ROOT/tools/build-musl-container.sh" "$TARGET" "$OPTIMIZE" "$PREFIX"
fi

"$ROOT/tools/fetch_onnxruntime.sh"
chmod +x "$ROOT/tools/zig-cc.sh" "$ROOT/tools/zig-cxx.sh"

rm -rf "$BUILD"
mkdir -p "$BUILD" "$OUT"
export ORT_ZIG_TARGET="$TARGET"
printf '%s\n' "$TARGET" > "$ROOT/tools/zig-target.txt"
cmake -S "$ROOT" -B "$BUILD" -G Ninja \
  "-DCMAKE_BUILD_TYPE=$CMAKE_BUILD_TYPE" \
  -DCMAKE_SYSTEM_PROCESSOR="$PROCESSOR" \
  -DCMAKE_TOOLCHAIN_FILE="$ROOT/tools/zig-toolchain.cmake" \
  -DFETCHCONTENT_TRY_FIND_PACKAGE_MODE=NEVER \
  -DCMAKE_FIND_USE_PACKAGE_REGISTRY=FALSE \
  -DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=FALSE \
  -DCMAKE_CXX_FLAGS=-Wno-error=deprecated-literal-operator
cmake --build "$BUILD" --target onnxruntime_wrapper --parallel
cmake --install "$BUILD" --component Unspecified --prefix "$OUT"
