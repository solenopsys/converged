#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE="$ROOT/native"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"

echo ">> build behemoth storage image"
(cd "$NATIVE/behemoth/storage" && TARGET=x86_64-linux-musl OPTIMIZE="$OPTIMIZE" ./build.sh)
(cd "$NATIVE/behemoth/storage" \
  && podman build -f Containerfile -t localhost/converged-storage:latest .)

echo ">> build resonus image"
(cd "$NATIVE/resonus" && IMAGE=localhost/converged-resonus:latest OPTIMIZE="$OPTIMIZE" ./build-container.sh)

echo ">> build fujin image"
(cd "$NATIVE/fujin" && IMAGE=localhost/converged-fujin:latest OPTIMIZE="$OPTIMIZE" ./build-container.sh)

echo ">> build centimanus image"
(cd "$NATIVE/centimanus" && IMAGE=localhost/converged-centimanus:latest OPTIMIZE="$OPTIMIZE" ./build-container.sh)

echo ">> build ptah image"
(cd "$NATIVE/ptah" && IMAGE=localhost/converged-ptah:latest OPTIMIZE="$OPTIMIZE" ./build-container.sh)

echo ">> images built"
podman images --format '{{.Repository}}:{{.Tag}} {{.Id}}' \
  | rg '^localhost/converged-(storage|resonus|fujin|centimanus|ptah):latest '
