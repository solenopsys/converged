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

Creates an in-memory hierarchical context. The `key` is supplied by the client
and is used to select this context during routing. Keys must be unique while
the process is running. A context contains sections, commands, and
language-specific example arrays.

    curl -X POST http://localhost:8000/contexts \
      -H 'content-type: application/json' \
      -d '{
        "key": "desktop-assistant",
        "sections": [
          {
            "id": "desktop",
            "commands": [
              {
                "id": "open_browser",
                "examples": {
                  "en": ["open a browser", "launch chrome"],
                  "ru": ["открой браузер", "запусти хром"]
                }
              }
            ]
          },
          {
            "id": "system",
            "commands": [
              {
                "id": "shutdown",
                "examples": {
                  "en": ["turn off the computer", "shutdown"],
                  "ru": ["выключи компьютер", "заверши работу"]
                }
              }
            ]
          }
        ]
      }'

Response:

    {
      "key": "desktop-assistant",
      "sections": 2,
      "commands": 2,
      "vectors": 8,
      "enc_ms": 0.0,
      "rss_mb": 0
    }

`vectors` is the number of language-specific examples encoded for the context.
Posting an existing key returns `409`; there is currently no update or delete
endpoint.

### POST /route

Routes a user text through the selected context. The `context` and `text`
fields are required. The optional `language` field can provide the detected
language explicitly. When omitted, CASE uses its built-in language detector.
CASE first evaluates the language-specific vectors, then aggregates basket
support by section, and finally selects the command inside the winning section.

    curl -X POST http://localhost:8000/route \
      -H 'content-type: application/json' \
      -d '{
        "context": "desktop-assistant",
        "language": "en",
        "text": "please open a browser"
      }'

Response:

    {
      "decision": "EXECUTE",
      "reason": "confident_match",
      "language": "en",
      "section": "desktop",
      "command": "open_browser",
      "score": 0.9876,
      "surface_weight": 0.0132,
      "surface_log_gap": 1.0214,
      "rss_mb": 0
    }

The section score uses a normalized exponential kernel over all examples in
the selected language. The initial parameters are `tau=0.05`,
`surface_ratio=1.5`, `execute_threshold=0.85`, and `command_margin=0.03`.

`decision` is one of:

* `EXECUTE` when the selected section and command pass their confidence checks;
* `AMBIGUOUS` when the section or command is not sufficiently separated;
* `UNKNOWN` when the selected language has no examples or the global best
  similarity is below `0.65`.

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
