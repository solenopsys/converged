#!/bin/sh
# Turn ptah's module environment into the Solution file the runtime reads.
#
# The image ships every module in the tree; which of them actually boot is a
# runtime decision. Ptah publishes that decision as `REPOSITORIES`, `LAMBDAS`
# and `FRONTEND_MODULES` in the platform's module ConfigMap, while the runtime
# still loads a Solution document — so one of the two has to be translated,
# and doing it here keeps both sides unchanged.
#
# Both backend lists are missing rather than empty when no platform is in front of
# this container. That is a misconfiguration, not an empty platform: a
# container that silently boots zero modules looks healthy and serves nothing.
set -eu

: "${SOLUTION_NAME:=converged}"

if [ -z "${SOLUTION_PATH:-}" ]; then
    if [ -z "${REPOSITORIES:-}" ] && [ -z "${LAMBDAS:-}" ] && [ -z "${FRONTEND_MODULES:-}" ]; then
        echo "entrypoint: set REPOSITORIES/LAMBDAS/FRONTEND_MODULES (ptah publishes them) or SOLUTION_PATH" >&2
        exit 78
    fi
    SOLUTION_PATH=/app/solution.json
    cat > "$SOLUTION_PATH" <<JSON
{
  "apiVersion": "ptah.io/v1alpha1",
  "kind": "Solution",
  "metadata": { "name": "${SOLUTION_NAME}" },
  "spec": {
	"repositories": ${REPOSITORIES:-[]},
	"lambdas": ${LAMBDAS:-[]},
    "surfaces": ${FRONTEND_MODULES:-[]},
    "workflows": ${WORKFLOWS:-[]}
  }
}
JSON
    export SOLUTION_PATH
fi

exec "$@"
