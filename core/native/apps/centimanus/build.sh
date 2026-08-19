#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseFast}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../}"

case "$TARGET" in
    x86_64-linux-musl) ARTIFACT_TARGET=x86_64-musl ;;
    aarch64-linux-musl) ARTIFACT_TARGET=aarch64-musl ;;
    x86_64-linux-gnu) ARTIFACT_TARGET=x86_64-gnu ;;
    aarch64-linux-gnu) ARTIFACT_TARGET=aarch64-gnu ;;
    *) echo "centimanus requires an x86_64/aarch64 GNU or musl target" >&2; exit 2 ;;
esac

ARTIFACT_DIR="zig-out/$ARTIFACT_TARGET"

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "$ARTIFACT_DIR"
(cd "$CONVERGED_ROOT/navite/wrappers/protocols/zimq" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "zig-out/$ARTIFACT_TARGET")

install -Dm644 "$CONVERGED_ROOT/navite/wrappers/protocols/zimq/zig-out/$ARTIFACT_TARGET/lib/libzimq.so" "$ARTIFACT_DIR/lib/libzimq.so"
