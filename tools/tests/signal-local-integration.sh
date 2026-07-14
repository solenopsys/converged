#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FUJIN_ZMQ_PORT="${FUJIN_ZMQ_PORT:-15557}"
FUJIN_WS_PORT="${FUJIN_WS_PORT:-18087}"
RESONUS_HTTP_PORT="${RESONUS_HTTP_PORT:-18090}"
CENTIMANUS_HTTP_PORT="${CENTIMANUS_HTTP_PORT:-19000}"
LOG_DIR="$(mktemp -d /tmp/converged-signal-local.XXXXXX)"
pids=()

cleanup() {
    for pid in "${pids[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    rm -rf "$LOG_DIR"
}
trap cleanup EXIT

require_file() {
    if [[ ! -f "$1" ]]; then
        echo "Missing native artifact: $1" >&2
        exit 1
    fi
}

require_file "$ROOT/native/fujin/zig-out/bin/fujin"
require_file "$ROOT/native/resonus/zig-out/bin/resonus"
require_file "$ROOT/native/centimanus/zig-out/bin/centimanus"
require_file "$ROOT/native/wrapers/qjs/zig-out/lib/libqjs.so"
require_file "$ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so"
require_file "$ROOT/native/resonus/.container-libs/libdatachannel.so"

FUJIN_ZMQ_BIND="tcp://127.0.0.1:${FUJIN_ZMQ_PORT}" \
FUJIN_WS_HOST=127.0.0.1 \
FUJIN_WS_PORT="$FUJIN_WS_PORT" \
FUJIN_FLUENTBIT=off \
FUJIN_QJS_LIB="$ROOT/native/wrapers/qjs/zig-out/lib/libqjs.so" \
FUJIN_ZIMQ_LIB="$ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so" \
    "$ROOT/native/fujin/zig-out/bin/fujin" >"$LOG_DIR/fujin.log" 2>&1 &
pids+=("$!")
sleep 1

LD_LIBRARY_PATH="$ROOT/native/resonus/.container-libs" \
RESONUS_FUJIN_ZMQ_ENDPOINT="tcp://127.0.0.1:${FUJIN_ZMQ_PORT}" \
RESONUS_FUJIN_ZIMQ_LIB="$ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so" \
LLM_GATE_HTTP_HOST=127.0.0.1 \
LLM_GATE_HTTP_PORT="$RESONUS_HTTP_PORT" \
LLM_GATE_SIP_ENABLED=false \
LLM_GATE_SERVICES_URL=http://127.0.0.1:3001/services \
LLM_GATE_VALKEY_URL=redis://127.0.0.1:6379/0 \
LLM_GATE_POLICY_SCRIPT="$ROOT/native/resonus/scripts/default.js" \
LLM_GATE_BARESIP_LIB="$ROOT/native/resonus/.container-libs/libbaresip.so" \
LLM_GATE_BARESIP_WRAPPER_LIB="$ROOT/native/resonus/.container-libs/libbaresip_wrapper.so" \
LLM_GATE_LIBDATACHANNEL_LIB="$ROOT/native/resonus/.container-libs/libdatachannel.so" \
LLM_GATE_LIBDATACHANNEL_WRAPPER_LIB="$ROOT/native/resonus/.container-libs/libdatachannel_wrapper.so" \
LLM_GATE_MBEDTLS_LIB="$ROOT/native/resonus/.container-libs/libmbedtls.so" \
LLM_GATE_QJS_LIB="$ROOT/native/resonus/.container-libs/libqjs.so" \
    "$ROOT/native/resonus/zig-out/bin/resonus" serve >"$LOG_DIR/resonus.log" 2>&1 &
pids+=("$!")

LD_LIBRARY_PATH="$ROOT/native/centimanus/zig-out/lib:$ROOT/native/wrapers/zimq/zig-out/lib" \
CENTIMANUS_FUJIN_ZMQ_ENDPOINT="tcp://127.0.0.1:${FUJIN_ZMQ_PORT}" \
CENTIMANUS_FUJIN_ZIMQ_LIB="$ROOT/native/wrapers/zimq/zig-out/lib/libzimq.so" \
RT_STATE_BACKEND=memory \
SERVICES_BASE=http://127.0.0.1:3001/services \
RT_BIND="127.0.0.1:${CENTIMANUS_HTTP_PORT}" \
    "$ROOT/native/centimanus/zig-out/bin/centimanus" \
    "127.0.0.1:${CENTIMANUS_HTTP_PORT}" >"$LOG_DIR/centimanus.log" 2>&1 &
pids+=("$!")
sleep 3

set +e
FUJIN_WS_PORT="$FUJIN_WS_PORT" bun -e '
const pending = new Set(["resonus", "centimanus"]);
const ws = new WebSocket(`ws://127.0.0.1:${process.env.FUJIN_WS_PORT}/ws`, {
  headers: { "x-storage-scope": "local-test" },
});
const timer = setTimeout(() => process.exit(2), 10_000);
ws.onmessage = (event) => {
  const message = JSON.parse(String(event.data));
  if (message.type === "ready") {
    for (const target of pending) {
      ws.send(JSON.stringify({
        type: "command",
        target,
        requestId: `local-${target}`,
        name: "unsupported.test",
        payload: {},
      }));
    }
    return;
  }
  const target = String(message.requestId || "").replace("local-", "");
  if (!pending.has(target)) return;
  if (message.type !== "error" || message.error?.code !== "provider_error") {
    process.exit(3);
  }
  pending.delete(target);
  if (pending.size === 0) {
    clearTimeout(timer);
    ws.close();
    process.exit(0);
  }
};
ws.onerror = () => process.exit(4);
'
status=$?
set -e

if ((status != 0)); then
    for log in "$LOG_DIR"/*.log; do
        echo "--- $(basename "$log") ---" >&2
        cat "$log" >&2
    done
    exit "$status"
fi

echo "signal local integration: ok (fujin -> resonus, centimanus)"
