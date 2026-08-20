#!/usr/bin/env bash
# Builds the curaengine processor and the native wrapper it dlopens into one
# musl artifact directory, laid out exactly as the container expects.
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseFast}"
ARTIFACT_DIR="zig-out/$TARGET"
WRAPPER_DIR="../../wrappers/slicers/curaengine"

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "$ARTIFACT_DIR"

# The wrapper is loaded at runtime, so it is built on its own and copied in.
(cd "$WRAPPER_DIR" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "zig-out/$TARGET")
install -Dm644 "$WRAPPER_DIR/zig-out/$TARGET/lib/libcuraengine.so" "$ARTIFACT_DIR/lib/libcuraengine.so"

echo ">> $ARTIFACT_DIR"
ls -1 "$ARTIFACT_DIR/bin" "$ARTIFACT_DIR/lib"
