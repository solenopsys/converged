#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-localhost/speach:latest}"
TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseFast}"

case "$TARGET" in
    x86_64-linux-musl|aarch64-linux-musl) ;;
    *) echo "speach Containerfile uses Alpine/musl; choose x86_64-linux-musl or aarch64-linux-musl" >&2; exit 2 ;;
esac

echo ">> zig build -Dtarget=$TARGET -Doptimize=$OPTIMIZE"
zig build -Dtarget="$TARGET" -Doptimize="$OPTIMIZE"

echo ">> podman build -f Containerfile -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .
