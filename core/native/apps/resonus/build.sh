#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-gnu}"
OPTIMIZE="${OPTIMIZE:-ReleaseFast}"
CONVERGED_ROOT="${CONVERGED_ROOT:-$(cd ../../../.. && pwd)}"

case "$TARGET" in
    x86_64-linux-gnu) ARTIFACT_TARGET=x86_64-gnu ;;
    aarch64-linux-gnu) ARTIFACT_TARGET=aarch64-gnu ;;
    *) echo "resonus requires a Linux GNU target: x86_64-linux-gnu or aarch64-linux-gnu" >&2; exit 2 ;;
esac

bun run "$CONVERGED_ROOT/core/tools/nrpc/src/zig-generator.ts" \
    "$CONVERGED_ROOT/modules/types/communications/resonus.ts" \
    "$CONVERGED_ROOT/core/native/apps/resonus/src/generated/resonus_client.zig" \
    "transport"

# providers/dist is a build output, not a checked-in artifact: hooks.js and the
# decode tables are what the gate evaluates at startup, and `zig build test`
# embeds the tables to keep the format and its reader in sync.
(cd providers && bun run build)

ARTIFACT_DIR="zig-out/$ARTIFACT_TARGET"

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "$ARTIFACT_DIR"
for wrapper in \
    "$CONVERGED_ROOT/core/native/wrappers/rt/qjs" \
    "$CONVERGED_ROOT/core/native/wrappers/protocols/zimq" \
    "$CONVERGED_ROOT/core/native/wrappers/protocols/libdatachannel" \
    "$CONVERGED_ROOT/core/native/wrappers/protocols/mbedtls" \
    "$CONVERGED_ROOT/core/native/wrappers/protocols/baresip" \
    "$CONVERGED_ROOT/core/native/libs/transport"; do
    (cd "$wrapper" && zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "zig-out/$ARTIFACT_TARGET")
done

install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/rt/qjs/zig-out/$ARTIFACT_TARGET/lib/libqjs.so" "$ARTIFACT_DIR/lib/libqjs.so"
install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/zimq/zig-out/$ARTIFACT_TARGET/lib/libzimq.so" "$ARTIFACT_DIR/lib/libzimq.so"
install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/libdatachannel/zig-out/$ARTIFACT_TARGET/lib/libdatachannel.so" "$ARTIFACT_DIR/lib/libdatachannel.so"
install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/libdatachannel/zig-out/$ARTIFACT_TARGET/lib/libdatachannel_wrapper.so" "$ARTIFACT_DIR/lib/libdatachannel_wrapper.so"
for lib in libmbedtls.so libmbedcrypto.so libmbedcrypto.so.18 libmbedx509.so libmbedx509.so.9 libtfpsacrypto.so.2; do
    install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/mbedtls/zig-out/$ARTIFACT_TARGET/lib/$lib" "$ARTIFACT_DIR/lib/$lib"
done
install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/baresip/zig-out/$ARTIFACT_TARGET/lib/libbaresip.so" "$ARTIFACT_DIR/lib/libbaresip.so"
install -Dm644 "$CONVERGED_ROOT/core/native/wrappers/protocols/baresip/zig-out/$ARTIFACT_TARGET/lib/libbaresip_wrapper.so" "$ARTIFACT_DIR/lib/libbaresip_wrapper.so"
install -Dm644 "$CONVERGED_ROOT/core/native/libs/transport/zig-out/$ARTIFACT_TARGET/lib/libtransport.so" "$ARTIFACT_DIR/lib/libtransport.so"
