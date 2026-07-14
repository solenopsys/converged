#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

case "$TARGET" in
    x86_64-linux-musl|aarch64-linux-musl) ;;
    *) echo "centimanus requires an Alpine/musl target: x86_64-linux-musl or aarch64-linux-musl" >&2; exit 2 ;;
esac

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE"
(cd "$CONVERGED_ROOT/native/wrapers/zimq" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE")

mkdir -p .container-bin .container-libs
cp "zig-out/bin/centimanus" .container-bin/centimanus
cp "zig-out/lib/libqjs.so" .container-bin/libqjs.so
cp "$CONVERGED_ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so" .container-libs/libzimq.so
