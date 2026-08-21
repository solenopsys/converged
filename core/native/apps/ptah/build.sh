#!/usr/bin/env bash
# Build ptah and its QuickJS wrapper for one target into zig-out/<arch>-<libc>.
#
# The policy is bundled into the binary by build.zig, so there is nothing to
# ship beside the executable except libqjs.so — which build.zig installs into
# the same prefix, and which the binary finds through its $ORIGIN/../lib rpath.
set -euo pipefail

cd "$(dirname "$0")"

TARGET="${TARGET:-x86_64-linux-musl}"
OPTIMIZE="${OPTIMIZE:-ReleaseFast}"

case "$TARGET" in
    x86_64-linux-musl) ARTIFACT_TARGET=x86_64-musl ;;
    aarch64-linux-musl) ARTIFACT_TARGET=aarch64-musl ;;
    x86_64-linux-gnu) ARTIFACT_TARGET=x86_64-gnu ;;
    aarch64-linux-gnu) ARTIFACT_TARGET=aarch64-gnu ;;
    *) echo "ptah requires an x86_64/aarch64 GNU or musl target" >&2; exit 2 ;;
esac

zig build "-Dtarget=$TARGET" "-Doptimize=$OPTIMIZE" --prefix "zig-out/$ARTIFACT_TARGET"
