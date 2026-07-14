# resonus (Zig)

## Runtime routing contract

`resonus` must route every call through explicit runtime inputs. The
gate must not invent a context, tenant, user, or `scope`. If the required
inputs are missing, the call must be refused. The `scope` is forwarded to
microservice APIs as the tenant routing header.

### WebRTC contour

WebRTC call setup uses one WebSocket handshake request:

```text
GET /ws?context_name=<context_name>&scope=<scope>&user=<user>
```

| Parameter | Exact source | Used for |
| --- | --- | --- |
| `context_name` | WebSocket query parameter `context_name` | Selects the call context |
| `scope` | WebSocket query parameter `scope` | Microservice tenant routing header |
| `user` | WebSocket query parameter `user` | Session label and call index data |

### SIP contour

SIP call setup starts from the dialed number:

```text
SIP To -> audio-gate-ms/phone-numbers -> { gateway.contextId, scope }
```

| Parameter | Exact source | Used for |
| --- | --- | --- |
| `context_name` | Phone-number record field `gateway.contextId` | Selects the call context |
| `scope` | Phone-number record field `scope` | Microservice tenant routing header |
| `user` | SIP `From` | Session label and call index data |

### 1. Context name

The context name is the logical call context key, for example `voice`.

For WebRTC calls it is supplied by the WebSocket query parameter
`context_name`.

The gate loads the context through the `contexts` service API. A missing,
incomplete, or mismatched context means the call is refused.

### 2. Persistence routing

There is no direct service-store transport in the gate.

- Audio fragments: `resonus -> Valkey` using Redis commands. The gate
  keeps the generated cache keys in the live session.
- Service state: `resonus -> microservice API` with the request `scope`
  forwarded as `scope` and `workspace` headers.
- Audio dump: on session close, the gate sends `calls.dumpAudioFragments` with
  the array of Valkey/cache keys and fragment metadata. `ms-calls` reads the
  cache entries through its `CacheAdapter`, writes the KVS fragment packet, and
  returns `{ received, stored, missing }`.

### 3. User

`user` is the caller/session label. It is not a context name and not a storage
selector.

For WebRTC calls it is supplied by the WebSocket query parameter `user`.

For SIP calls it is supplied by SIP `From`.

The gate may persist `user` into session and call indexes, but it must not use
`user` to choose the context or tenant. Context selection uses context name;
tenant routing uses `scope`.

### SIP scenario

SIP has an additional mapping step because the call does not naturally carry the
web landing context name.

Current SIP inputs:

- dialed number: SIP `To`
- caller identity: SIP `From`

SIP context selection:

```text
dialed number -> phone-numbers store -> gateway.contextId -> contexts-ms/contexts
```

The phone-number records live in `audio-gate-ms/phone-numbers`. Number matching
is digits-only, so a SIP URI like `+17025550142` can match a stored display
number like `+1 (702) 555-0142`.

The phone-number mapping must include `scope` alongside `gateway.contextId`.
That makes the SIP route explicit for service API calls:

```text
dialed number -> phone-number record -> { contextId, scope }
scope -> service API tenant headers
contextId -> call context
```

Without `scope` in the phone-number mapping, SIP cannot safely select tenant
state.

Pure-Zig gate for LLM audio signaling and context operations.

## Scriptable call policy

Call routing and AI session selection are controlled by a small JavaScript
policy executed in the embedded QuickJS-ng wrapper. Zig remains responsible for
SIP/WebRTC/RTP, media, persistence and validation; JavaScript only returns a
typed call plan.

```js
function onIncomingCall(call, gateway) {
  if (call.caller.startsWith("+84")) {
    return gateway.ai({
      contextId: "club-voice",
      model: "gpt-realtime-2.1",
      voice: "marin",
      transcriptionModel: "gpt-realtime-whisper",
      ...gateway.transferToHuman("sip:sales@sip.example.com"),
    });
  }
  return gateway.fromRoute(call);
}
```

Available constructors:

- `gateway.ai(options)` selects an interactive AI session. `contextId` is
  required; `provider`, `model`, `voice`, `transcriptionModel`, VAD fields and
  `humanTransferUri` are optional. The current media executor supports
  `provider: "openai"`; another provider is added behind the same plan contract.
- `gateway.human(sipUri, options)` directly bridges the caller to a human and
  can select `language` and `transcriptionModel` for per-leg transcription.
- `gateway.reject(status)` refuses the call before allocating media resources.
- `gateway.fromRoute(call)` preserves the route returned by the phone-number
  service.
- `gateway.transferToHuman(sipUri)` enables the `transfer_to_human` AI tool.
  The model can invoke it during a SIP call; the gateway replaces the AI media
  endpoint with the human bridge on the SIP owner thread.

Validate a policy without placing a call:

```bash
LLM_GATE_POLICY_SCRIPT=scripts/club-example.js \
  zig build run -- policy-check +84901234567 18005550000 voice
```

/dial sip:78632020220@192.168.100.196:5060


## Scope

- OpenAI Realtime API v2 signaling adapter (`/v1/realtime/calls` unified multipart SDP flow).
- OpenAI WebSocket signaling compatibility endpoint: `GET /ws` with `offer/answer/ice-candidate` message model.
- Gemini signaling adapter (separate flow and payload model).
- Native dependency probing for:
  - `libbaresip.so`
  - `libbaresip_wrapper.so`
  - `libdatachannel.so`
  - `libdatachannel_wrapper.so`
  - `libmbedtls.so`
- Persistence split:
  - raw Opus audio fragments are written to Valkey through the Redis protocol;
  - contexts, phone mappings, call rows, thread messages, and fragment-dump
    commands go through microservice HTTP/nRPC APIs.

## Build

```bash
zig build
```

## Run

```bash
zig build run
```

By default it starts HTTP API on `0.0.0.0:8090`.

### OpenAI WS compatibility

`/ws` accepts the same client-side signaling message model as the old gate:

- incoming: `{"type":"offer","data":{"type":"offer","sdp":"..."}}`
- incoming context override: `{"type":"offer","sdp":"...","phone":"+7900...","contextName":"club"}`
- outgoing: `{"type":"answer","data":{"type":"answer","sdp":"..."}}`
- incoming `ice-candidate` messages are accepted and ignored (direct OpenAI SDP exchange path).

## Container

Build a static musl binary, then package it into a minimal image:

```bash
zig build -Doptimize=ReleaseSafe -Dtarget=x86_64-linux-musl
podman build -f Containerfile -t resonus .
podman run -d -p 8090:8090 -e OPENAI_API_KEY=sk-... resonus
```

Local converged-portal run command is kept in `./run-converged-local.sh`.

The image serves the HTTP signaling API (OpenAI/Gemini + `/ws`) on port `8090`.
Native SIP/WebRTC `.so` libs are not bundled, so the dependency probe reports
them as unavailable and SIP stays disabled (`LLM_GATE_SIP_ENABLED` unset). The
container is stateless; context, audio fragments, and transcript events are
routed through Valkey and service APIs. The gate never writes service stores
directly.

## CLI modes

```bash
# Probe native libraries
zig build run -- probe-libs

# Native wrapper smoke test
zig build run -- native-smoke

# OpenAI signaling from SDP offer file
zig build run -- signal-openai ./offer.sdp --context-name=club

# Gemini signaling descriptor
zig build run -- signal-gemini

# Context operations through the contexts service API
zig build run -- context-set user123 "custom context"
zig build run -- context-get user123
```

## Main env vars

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL` (default `gpt-realtime-2.1`)
- `OPENAI_REALTIME_VOICE` (default `marin`; old `OPENAI_VOICE` is also accepted)
- `OPENAI_REALTIME_TRANSCRIPTION_MODEL` (default `gpt-4o-transcribe`)
- `OPENAI_REALTIME_NOISE_REDUCTION` (default `far_field`)
- `OPENAI_REALTIME_CALLS_URL` (default `https://api.openai.com/v1/realtime/calls`)
- `LLM_GATE_QJS_LIB` (default `<converged-root>/native/wrapers/qjs/zig-out/lib/libqjs.so`)
- `RESONUS_FUJIN_ZMQ_ENDPOINT` (default `tcp://127.0.0.1:5557`; `FUJIN_ZMQ_ENDPOINT` is the shared fallback)
- `RESONUS_FUJIN_ZIMQ_LIB` (target-specific `libzimq` path; `FUJIN_ZIMQ_LIB` is the shared fallback)
- `RESONUS_FUJIN_ZMQ_IDENTITY` (default `resonus`)
- `LLM_GATE_POLICY_SCRIPT` (default `scripts/default.js`)
- `LLM_GATE_POLICY_REQUIRED` (default `true`; fail startup instead of bypassing a broken policy)
- `OPENAI_SAFETY_IDENTIFIER` (optional override; otherwise `phone` is hashed when present)
- `GEMINI_API_KEY`
- `LLM_GATE_HTTP_HOST` (default `0.0.0.0`)
- `LLM_GATE_HTTP_PORT` (default `8090`)
- `LLM_GATE_CONVERGED_ROOT` (default `/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal`)
- `LLM_GATE_SERVICES_URL` (default `http://127.0.0.1:3000/services`; old `LLM_GATE_THREADS_SERVICE_URL` is accepted as fallback)
- `LLM_GATE_SERVICES_TOKEN` (optional bearer token; old `LLM_GATE_THREADS_SERVICE_TOKEN` is accepted as fallback)
- `LLM_GATE_VALKEY_URL` (default `redis://127.0.0.1:6379/0`; `VALKEY_URL`, `REDIS_URL`, and `RUNTIME_CACHE_URL` are accepted as fallbacks)
- `LLM_GATE_VALKEY_KEY_PREFIX` (default `cache`)
- `LLM_GATE_VALKEY_TTL_SECONDS` (default `120`)
