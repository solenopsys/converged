#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-gnu}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

case "$TARGET" in
    x86_64-linux-gnu|aarch64-linux-gnu) ;;
    *) echo "fujin requires a Linux GNU target: x86_64-linux-gnu or aarch64-linux-gnu" >&2; exit 2 ;;
esac

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE"
(cd "$CONVERGED_ROOT/native/wrapers/qjs" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE")
(cd "$CONVERGED_ROOT/native/wrapers/zimq" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE")

mkdir -p .container-libs
cp "$CONVERGED_ROOT/native/wrapers/qjs/zig-out/lib/libqjs.so" .container-libs/libqjs.so
cp "$CONVERGED_ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so" .container-libs/libzimq.so
