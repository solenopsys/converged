#!/bin/sh
# Turn ptah's module environment into the Solution file the runtime reads.
#
# The image ships every module in the tree; which of them actually boot is a
# runtime decision. Ptah publishes that decision as `MICROSERVICES` and
# `FRONTEND_MODULES` in the platform's module ConfigMap, while the runtime
# still loads a Solution document — so one of the two has to be translated,
# and doing it here keeps both sides unchanged.
#
# `MICROSERVICES` is missing rather than empty when no platform is in front of
# this container. That is a misconfiguration, not an empty platform: a
# container that silently boots zero modules looks healthy and serves nothing.
set -eu

: "${SOLUTION_NAME:=converged}"

if [ -z "${SOLUTION_PATH:-}" ]; then
    if [ -z "${MICROSERVICES:-}" ] && [ -z "${FRONTEND_MODULES:-}" ]; then
        echo "entrypoint: set MICROSERVICES/FRONTEND_MODULES (ptah publishes both) or SOLUTION_PATH" >&2
        exit 78
    fi
    SOLUTION_PATH=/app/solution.json
    cat > "$SOLUTION_PATH" <<JSON
{
  "apiVersion": "ptah.io/v1alpha1",
  "kind": "Solution",
  "metadata": { "name": "${SOLUTION_NAME}" },
  "spec": {
    "microservices": ${MICROSERVICES:-[]},
    "microfrontends": ${FRONTEND_MODULES:-[]},
    "workflows": ${WORKFLOWS:-[]}
  }
}
JSON
    export SOLUTION_PATH
fi

exec "$@"
