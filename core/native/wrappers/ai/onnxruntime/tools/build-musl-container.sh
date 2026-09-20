#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?target is required, e.g. x86_64-linux-musl}"
OPTIMIZE="${2:-ReleaseFast}"
PREFIX="${3:-zig-out}"
ENGINE="${CONTAINER_ENGINE:-podman}"

case "$TARGET" in
  x86_64-linux-musl) PLATFORM=linux/amd64; ARCH=x86_64 ;;
  aarch64-linux-musl) PLATFORM=linux/arm64; ARCH=aarch64 ;;
  *) echo "unsupported Alpine target: $TARGET" >&2; exit 2 ;;
esac

command -v "$ENGINE" >/dev/null || {
  echo "container engine not found: $ENGINE (set CONTAINER_ENGINE=docker or install podman)" >&2
  exit 127
}

IMAGE="${ORT_MUSL_IMAGE:-onnxruntime-wrapper-musl:local}"
"$ENGINE" build \
  --platform "$PLATFORM" \
  --build-arg "ZIG_ARCH=$ARCH" \
  -f "$ROOT/tools/musl.Containerfile" \
  -t "$IMAGE" \
  "$ROOT/tools"

"$ENGINE" run --rm \
  --platform "$PLATFORM" \
  -e ORT_MUSL_IN_CONTAINER=1 \
  -e HOME=/tmp \
  -v "$ROOT:/src" \
  -w /src \
  "$IMAGE" \
  ./tools/build.sh "$TARGET" "$OPTIMIZE" "$PREFIX"
