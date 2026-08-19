#!/usr/bin/env bash
# Build the Linux binary and package it into the container image.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-localhost/converged-resonus:latest}"
TARGET="${TARGET:-x86_64-linux-gnu}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

case "$TARGET" in
    x86_64-linux-gnu|aarch64-linux-gnu) ;;
    *) echo "resonus Containerfile uses Debian/glibc; choose x86_64-linux-gnu or aarch64-linux-gnu" >&2; exit 2 ;;
esac

TARGET="$TARGET" OPTIMIZE="$OPTIMIZE" CONVERGED_ROOT="$CONVERGED_ROOT" "$SCRIPT_DIR/build.sh"

echo ">> podman build -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .

echo ">> done: $IMAGE"
echo "   run: podman run -d -p 8090:8090 -e OPENAI_API_KEY=sk-... $IMAGE"
