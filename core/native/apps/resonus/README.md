# resonus (Zig)

## Runtime routing contract

For the Fujin message ingress, `resonus` accepts only the explicit trusted
context from the envelope. It does not derive a tenant or `scope` from the
payload: a missing scope is refused. The scope is retained in the session and
forwarded to microservices as the `scope` and `workspace` headers.

The current compatibility HTTP/WebSocket and SIP ingresses do not provide the
same authorization property. They are transitional paths and must remain
internal until they are brought behind a trusted transport.

### Fujin message contour

The process registers with Fujin as target `resonus` and currently supports:

| Команда | Вход | Ответ |
| --- | --- | --- |
| `call.offer` | `sdp`, `contextName`; optional `language`, `user`, `phone` | `call.answer` with `sessionId` and SDP answer |
| `call.ice` | `sessionId` | `call.ice_ack`; the candidate is not applied in the direct SDP path |
| `call.hangup` | `sessionId` | `call.ended` |

Every command requires non-empty `scope` and `requestId` in the envelope.
Fujin binds the scope to the external connection; Resonus uses it only as the
session's incoming context.

### WebRTC compatibility contour

The legacy WebSocket signaling endpoint uses this handshake:

```text
GET /ws?context_name=<context_name>&scope=<scope>&user=<user>
```

| Parameter | Exact source | Used for |
| --- | --- | --- |
| `context_name` | WebSocket query parameter `context_name` | Selects the call context |
| `scope` | WebSocket query parameter `scope` | Legacy tenant header, not a trusted auth context |
| `user` | WebSocket query parameter `user` | Session label and call index data |

### SIP contour

SIP call setup starts from the dialed number:

```text
SIP To -> phone-numbers service -> gateway.contextId or gateway.transfer
```

| Parameter | Exact source | Used for |
| --- | --- | --- |
| `context_name` | Phone-number record field `gateway.contextId` | Selects the call context |
| `scope` | absent from the current SIP route lookup | Cannot safely select a tenant |
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
  the array of Valkey/cache keys and fragment metadata. `rp-calls` reads the
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

SIP has no browser workspace context. In the current code, the normalized SIP
`To` number is resolved through the phone-numbers service with an empty scope;
the route then uses `gateway.contextId` or `gateway.transfer`. A scope from the
phone-number record is neither read nor retained in the session.

SIP is therefore not yet a safe multi-tenant ingress. It needs a trusted scope
source, such as a SIP trunk/number-to-scope binding in the gateway, before it
performs service calls. Until then, SIP must be used only in an isolated
single-scope environment.

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
      transcriptionModel: "gpt-transcribe",
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
  `language` is passed through as the GPT-Transcribe `languages` list, so it
  accepts a comma-separated value (`"ru,en"`) as well as a single code.
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

## Transcription (GPT-Transcribe)

Input transcription runs on the GPT-Transcribe family, not Whisper:

- calls (`type: "realtime"` and the transcription-only leg of a human transfer)
  use `gpt-transcribe` in a Realtime session, which transcribes turns as server
  VAD commits them;
- dictation does not open a Realtime session at all. The gate buffers the
  browser's Opus frames, and on stop muxes them into WebM and sends one request
  to `/v1/audio/transcriptions` with the same model. A Realtime leg bills audio
  tokens for everything streamed into it and needs ~1.5 s of setup before it
  can carry a frame — which is exactly when the user is already talking. One
  file, one pass, no VAD slicing, and nothing lost at the start.

Consequence of the dictation design: there is no live text while speaking. The
transcript arrives once, shortly after the button is released (~1.6 s for a 7 s
dictation, measured). Partial text only exists inside a Realtime session.

`gpt-live-transcribe` is unusable over `POST /v1/realtime/calls`: it hangs and
answers 504 after ~15 s in every field combination (with `languages`, with the
legacy `language`, with no language at all), so a session built on it never
opens. The same 504 appears when a legacy model (`gpt-4o-transcribe`,
`gpt-4o-mini-transcribe`) is sent `languages` — old models and the new field
cannot be mixed. The file endpoint (`/v1/audio/transcriptions`) accepts
`gpt-transcribe` with `languages`, `prompt` and `keywords`, and rejects
`gpt-live-transcribe` outright: that model is streaming-only.

The session config carries `languages` (an array) instead of Whisper's single
`language`. Everything that used to supply one language code to transcription —
the call context's `language`, a policy `language` on a human leg, the
`dictation.start` payload — is now a comma-separated list: `"ru"` and `"ru,en"`
are both valid, and an empty value omits the key so the model auto-detects.
(The `language` of `call.offer` is unrelated: it selects the `<lang>/<name>`
context variant.) Two accuracy hints are optional and omitted unless
configured: `prompt` (free-form context about the recording) and `keywords`
(literal domain terms; each must be a single-line literal without `<` or `>`,
otherwise the session config fails with `InvalidTranscriptionKeyword`).

For calls the data-channel events are unchanged
(`conversation.item.input_audio_transcription.delta` / `.completed`), so the
transcript path needs no adaptation. The new models do not provide
word/segment timestamps, SRT/VTT output, or diarization.

`zig build dictation-smoke` covers the dictation path end to end: it muxes the
Russian fixture with the production muxer, sends it, and asserts the beginning,
middle and end of the utterance survive.

## Main env vars

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_IDLE_PER_MODEL` (number of preconnected idle text-Realtime sessions per configured model; default `3`, allowed range `1..16`)
- `OPENAI_REALTIME_MODEL` (default `gpt-realtime-2.1`)
- `OPENAI_REALTIME_VOICE` (default `marin`; old `OPENAI_VOICE` is also accepted)
- `OPENAI_REALTIME_TRANSCRIPTION_MODEL` (default `gpt-transcribe`)
- `OPENAI_REALTIME_TRANSCRIPTION_PROMPT` (optional free-form context, e.g. "a
  support call about CNC orders")
- `OPENAI_REALTIME_TRANSCRIPTION_KEYWORDS` (optional comma-separated literal
  terms, e.g. `AC-42,Premium Plus`)
- `OPENAI_DICTATION_TRANSCRIPTION_MODEL` (default `gpt-transcribe`)
- `OPENAI_DICTATION_TRANSCRIPTION_PROMPT`,
  `OPENAI_DICTATION_TRANSCRIPTION_KEYWORDS` (same meaning, dictation leg)
- `OPENAI_REALTIME_NOISE_REDUCTION` (default `far_field`)
- `OPENAI_REALTIME_CALLS_URL` (default `https://api.openai.com/v1/realtime/calls`)
- `OPENAI_TRANSCRIPTIONS_URL` (default `https://api.openai.com/v1/audio/transcriptions`; the dictation path)
- `LLM_GATE_QJS_LIB` (default `<converged-root>/native/wrapers/qjs/zig-out/lib/libqjs.so`)
- `RESONUS_FUJIN_ZMQ_ENDPOINT` (default `tcp://127.0.0.1:5557`; `FUJIN_ZMQ_ENDPOINT` is the shared fallback)
- `RESONUS_FUJIN_CLIENT_TARGET` (default `resonus-nrpc`; `FUJIN_CLIENT_TARGET` is the shared fallback)
- `RESONUS_FUJIN_ZIMQ_LIB` (target-specific `libzimq` path; `FUJIN_ZIMQ_LIB` is the shared fallback)
- `RESONUS_FUJIN_ZMQ_IDENTITY` (default `resonus`)
- `LLM_GATE_POLICY_SCRIPT` (default `scripts/default.js`)
- `LLM_GATE_POLICY_REQUIRED` (default `true`; fail startup instead of bypassing a broken policy)
- `OPENAI_SAFETY_IDENTIFIER` (optional override; otherwise `phone` is hashed when present)
- `GEMINI_API_KEY`
- `LLM_GATE_HTTP_HOST` (default `0.0.0.0`)
- `LLM_GATE_HTTP_PORT` (default `8090`)
- `LLM_GATE_CONVERGED_ROOT` (default `/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal`)
- `LLM_GATE_VALKEY_URL` (default `redis://127.0.0.1:6379/0`; `VALKEY_URL`, `REDIS_URL`, and `RUNTIME_CACHE_URL` are accepted as fallbacks)
- `LLM_GATE_VALKEY_KEY_PREFIX` (default `cache`)
- `LLM_GATE_VALKEY_TTL_SECONDS` (default `120`)
