# CASE native MVP

Pure Zig HTTP service for semantic command routing. CASE keeps command
contexts in memory: the process starts with an empty context map, clients load
contexts through the API, and all contexts disappear when the process exits.
The executable links the prebuilt ONNX Runtime wrapper and exposes
`POST /contexts`, `POST /route`, `GET /stats`, and `GET /healthz`.

Build and run on the local GNU target:

    zig build
    CASE_MODEL=/path/granite97.onnx CASE_TOKENIZER=/path/tokenizer.json zig-out/bin/case

Build the ONNX Runtime wrapper once for the target. The AI service consumes
that library from the wrapper's on-disk output and does not rebuild it:

    (cd ../../wrappers/ai/onnxruntime && zig build -Dtarget=x86_64-linux-musl)
    zig build -Dtarget=x86_64-linux-musl
    podman build -t case-native .
    podman run --rm -p 8000:8000 -v /path/to/model-dir:/models:ro case-native

The second `zig build` only builds the CASE executable and copies the
prebuilt `libonnxruntime.so` into `zig-out/lib` for the container image.

The mounted model directory must contain granite97.onnx, granite97.onnx.data,
and tokenizer.json. CASE_MODEL, CASE_TOKENIZER, CASE_HOST, CASE_PORT,
CASE_TH_EXECUTE, CASE_TH_UNKNOWN, and CASE_MARGIN configure the service.

## API

The examples below use `http://localhost:8000`. When running the test
container from the host, use `http://localhost:18000` instead.

All request bodies are JSON and all responses use
`application/json; charset=utf-8`. The maximum request body is 2 MiB.

### GET /healthz

Returns the process health status.

    curl http://localhost:8000/healthz

Response:

    {"ok":true}

### POST /contexts

Creates an in-memory context. The `key` is supplied by the client and is used
to select this context during routing. Keys must be unique while the process
is running. A context contains one or more commands; each command requires an
`id` and an `examples` array. `solution` is optional and can be used as a
second-level filter during routing.

    curl -X POST http://localhost:8000/contexts \
      -H 'content-type: application/json' \
      -d '{
        "key": "desktop-assistant",
        "commands": [
          {
            "id": "open_browser",
            "solution": "desktop",
            "examples": ["open a browser", "launch chrome"]
          },
          {
            "id": "shutdown",
            "solution": "system",
            "examples": ["turn off the computer", "shutdown"]
          }
        ]
      }'

Response:

    {
      "key": "desktop-assistant",
      "commands": 2,
      "vectors": 4,
      "enc_ms": 0.0,
      "rss_mb": 0
    }

`vectors` is the number of examples encoded for the context. Posting an
existing key returns `409`; there is currently no update or delete endpoint.

### POST /route

Routes a user text through the selected context. The `context` and `text`
fields are required. The optional `solution` field limits matching to commands
with the same solution value.

    curl -X POST http://localhost:8000/route \
      -H 'content-type: application/json' \
      -d '{
        "context": "desktop-assistant",
        "text": "please open a browser",
        "solution": "desktop"
      }'

Response:

    {
      "decision": "EXECUTE",
      "command": "open_browser",
      "score": 0.9876,
      "alternatives": [],
      "enc_ms": 0.0,
      "match_ms": 0.0,
      "rss_mb": 0
    }

`decision` is one of:

* `EXECUTE` when the best score is above `0.90` and leads the second-best
  score by at least `0.05`;
* `AMBIGUOUS` when a match exists but is not sufficiently separated;
* `UNKNOWN` when the score is below `0.83`, or when the selected context has
  no matching entries.

If `context` does not exist, the endpoint returns `404`:

    {"error":"context not found"}

### GET /stats

Returns aggregate in-memory state for all contexts.

    curl http://localhost:8000/stats

Response:

    {
      "rss_mb": 0,
      "contexts": 1,
      "vectors": 4,
      "commands": 2,
      "th_execute": 0.9,
      "th_unknown": 0.83,
      "margin": 0.05
    }

`rss_mb` is the process RSS reported by the service. For container-level
memory usage, use `podman stats` or `docker stats`.

### Errors

Malformed JSON, missing required fields, invalid command structures, and
oversized payloads return an appropriate 4xx response with an `error` field.
Unknown paths return `404`.

There is no authentication, persistence, or configuration-file loading in
this MVP. Clients must upload their contexts again after every process restart.
