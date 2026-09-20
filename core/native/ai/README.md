# CASE native MVP

Pure Zig HTTP service for semantic command routing. The executable links the
local ONNX Runtime wrapper and exposes POST /commands, POST /route, GET /stats,
and GET /healthz.

Build and run on the local GNU target:

    zig build
    CASE_MODEL=/path/granite97.onnx CASE_TOKENIZER=/path/tokenizer.json zig-out/bin/case

For Alpine, the ONNX Runtime wrapper is built through its native musl
container path:

    zig build -Dtarget=x86_64-linux-musl
    podman build -t case-native .
    podman run --rm -p 8000:8000 -v /path/to/model-dir:/models:ro case-native

The mounted model directory must contain granite97.onnx, granite97.onnx.data,
and tokenizer.json. CASE_MODEL, CASE_TOKENIZER, CASE_HOST, CASE_PORT,
CASE_TH_EXECUTE, CASE_TH_UNKNOWN, and CASE_MARGIN configure the service.
