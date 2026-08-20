#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-localhost/converged-curaengine:latest}"
TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"

case "$TARGET" in
    x86_64-linux-musl) ;;
    *) echo "the Containerfile is Alpine/musl; choose x86_64-linux-musl" >&2; exit 2 ;;
esac

TARGET="$TARGET" OPTIMIZE="$OPTIMIZE" "$SCRIPT_DIR/build.sh"

echo ">> podman build -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .
