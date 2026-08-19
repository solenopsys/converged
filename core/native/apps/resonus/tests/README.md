# Tests

## Unit tests (storage chain, no infrastructure)

These tests verify that Store, Transcript, and Recorder populate storage
(threads, calls/fragments, context) when data passes through the gateway.
They use the in-memory behemoth transport mock
(`converged-portal/native/behemoth/transport/src/mock.zig`): the same C ABI
and dlopen path as production, without sockets or persistent storage.

```bash
zig build test-store   # storage tests only (src/store_tests.zig)
zig build test         # all unit tests
```

# Integration Tests

## Isolated dictation media diagnostic

This does not start `Gateway`, SIP, HTTP, fujin, or a browser. It sends the
controlled TTS fixture directly through `OpenAIBridge` and requires OpenAI
transcription events containing the beginning, middle, and end of the phrase.

```bash
cd navite/apps/resonus
set -a; source ../../../../confs/converged-local.env; set +a
zig build dictation-smoke
```

Pass another Ogg/Opus fixture as the sole argument when needed:

```bash
zig build dictation-smoke -- tests/fixtures/dictation-ru.opus
```

```bash
pip install -r requirements.txt

# Zig tests only (running on port 8090)
RUN_ZIG=1 pytest -v

# With mock OpenAI (OPENAI_REALTIME_CALLS_URL must point to the mock)
RUN_ZIG=1 pytest -v test_sip.py::TestSipWithMockOpenAI
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `RUN_ZIG` | `1` | Enable the Zig gateway |
| `ZIG_HTTP_PORT` | `8090` | Zig HTTP port |
| `ZIG_SIP_PORT` | `5061` | Zig SIP port |
| `MOCK_OPENAI_PORT` | `19876` | Mock OpenAI server port |
