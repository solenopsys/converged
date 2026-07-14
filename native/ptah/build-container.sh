#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE="${IMAGE:-localhost/converged-ptah:latest}"
TARGET="${TARGET:-x86_64-linux-gnu}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

case "$TARGET" in
    x86_64-linux-gnu) ;;
    *) echo "ptah Containerfile uses native glibc plugin wrappers; choose x86_64-linux-gnu" >&2; exit 2 ;;
esac

TARGET="$TARGET" OPTIMIZE="$OPTIMIZE" CONVERGED_ROOT="$CONVERGED_ROOT" "$SCRIPT_DIR/build.sh"

echo ">> podman build -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .
