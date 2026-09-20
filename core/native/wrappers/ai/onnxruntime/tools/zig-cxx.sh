#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="${ORT_ZIG_TARGET:-$(<"$ROOT/zig-target.txt")}" # target from environment or generated file
args=()
for arg in "$@"; do
  [[ "$arg" == "-I/usr/include" ]] && continue
  args+=("$arg")
done
exec zig c++ "-target" "$TARGET" "${args[@]}"
