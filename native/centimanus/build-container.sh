#!/usr/bin/env bash
# Build the Linux binary and package it into the container image.
set -euo pipefail

cd "$(dirname "$0")"

IMAGE="${IMAGE:-centimanus}"
TARGET="${TARGET:-x86_64-linux-gnu}"
OPTIMIZE="${OPTIMIZE:-ReleaseSafe}"
CONVERGED_ROOT="${CONVERGED_ROOT:-../../../converged-portal}"

echo ">> zig build (-Dtarget=$TARGET -Doptimize=$OPTIMIZE)"
zig build "-Doptimize=$OPTIMIZE" "-Dtarget=$TARGET"

echo ">> copy native libs"
mkdir -p .container-libs
(cd "$CONVERGED_ROOT/native/wrapers/qjs" && zig build -Doptimize="$OPTIMIZE" -Dtarget="$TARGET")
cp "$CONVERGED_ROOT/native/wrapers/qjs/zig-out/lib/libqjs.so" .container-libs/libqjs.so
cp "$CONVERGED_ROOT/native/wrapers/libdatachannel/zig-out/lib/libdatachannel.so" .container-libs/libdatachannel.so
cp "$CONVERGED_ROOT/native/wrapers/libdatachannel/zig-out/lib/libdatachannel_wrapper.so" .container-libs/libdatachannel_wrapper.so
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libmbedtls.so" .container-libs/libmbedtls.so
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libmbedcrypto.so" .container-libs/libmbedcrypto.so
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libmbedcrypto.so.18" .container-libs/libmbedcrypto.so.18
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libmbedx509.so" .container-libs/libmbedx509.so
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libmbedx509.so.9" .container-libs/libmbedx509.so.9
cp "$CONVERGED_ROOT/native/wrapers/mbedtls/zig-out/lib/libtfpsacrypto.so.2" .container-libs/libtfpsacrypto.so.2
cp "$CONVERGED_ROOT/native/wrapers/baresip/zig-out/lib/libbaresip.so" .container-libs/libbaresip.so
cp "$CONVERGED_ROOT/native/wrapers/baresip/zig-out/lib/libbaresip_wrapper.so" .container-libs/libbaresip_wrapper.so
cp "$CONVERGED_ROOT/native/behemoth/transport/zig-out/lib/libtransport.so" .container-libs/libtransport.so

echo ">> podman build -t $IMAGE"
podman build -f Containerfile -t "$IMAGE" .

echo ">> done: $IMAGE"
echo "   run: podman run -d -p 8090:8090 -e OPENAI_API_KEY=sk-... $IMAGE"
