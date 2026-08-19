#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-localhost/converged-centimanus:latest}"
TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

case "$TARGET" in
    x86_64-linux-musl) ARTIFACT_TARGET=x86_64-musl ;;
    aarch64-linux-musl) ARTIFACT_TARGET=aarch64-musl ;;
    *) echo "centimanus Containerfile uses Alpine/musl; choose x86_64-linux-musl or aarch64-linux-musl" >&2; exit 2 ;;
esac

TARGET="$TARGET" OPTIMIZE="$OPTIMIZE" CONVERGED_ROOT="$CONVERGED_ROOT" "$SCRIPT_DIR/build.sh"

echo ">> podman build -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .
