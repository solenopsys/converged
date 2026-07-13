#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-centimanus-converged}"
IMAGE="${IMAGE:-localhost/centimanus:latest}"
HTTP_HOST="${LLM_GATE_HTTP_HOST:-127.0.0.1}"
HTTP_PORT="${LLM_GATE_HTTP_PORT:-8091}"
SIP_PUBLIC_IP="${LLM_GATE_SIP_PUBLIC_IP:-192.168.100.196}"
SERVICES_URL="${LLM_GATE_SERVICES_URL:-http://127.0.0.1:3001/services}"
VALKEY_URL="${LLM_GATE_VALKEY_URL:-redis://127.0.0.1:6379/0}"

OPENAI_API_KEY_VALUE="${OPENAI_API_KEY:-}"
if [[ -z "$OPENAI_API_KEY_VALUE" ]] && podman container exists "$CONTAINER_NAME"; then
  OPENAI_API_KEY_VALUE="$(
    podman inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^OPENAI_API_KEY=//p' \
      | head -n1
  )"
fi

if [[ -z "$OPENAI_API_KEY_VALUE" ]]; then
  echo "OPENAI_API_KEY is required. Export it or start from an existing $CONTAINER_NAME container." >&2
  exit 1
fi

podman run -d --replace --name "$CONTAINER_NAME" --network host \
  -e OPENAI_API_KEY="$OPENAI_API_KEY_VALUE" \
  -e OPENAI_REALTIME_MODEL="${OPENAI_REALTIME_MODEL:-gpt-realtime-2.1}" \
  -e LLM_GATE_POLICY_SCRIPT="${LLM_GATE_POLICY_SCRIPT:-/app/scripts/default.js}" \
  -e LLM_GATE_HTTP_HOST="$HTTP_HOST" \
  -e LLM_GATE_HTTP_PORT="$HTTP_PORT" \
  -e LLM_GATE_SERVICES_URL="$SERVICES_URL" \
  -e LLM_GATE_VALKEY_URL="$VALKEY_URL" \
  -e LLM_GATE_VALKEY_KEY_PREFIX="${LLM_GATE_VALKEY_KEY_PREFIX:-cache}" \
  -e LLM_GATE_SIP_ENABLED="${LLM_GATE_SIP_ENABLED:-true}" \
  -e LLM_GATE_SIP_PORT="${LLM_GATE_SIP_PORT:-5060}" \
  -e LLM_GATE_SIP_PUBLIC_IP="$SIP_PUBLIC_IP" \
  "$IMAGE"
