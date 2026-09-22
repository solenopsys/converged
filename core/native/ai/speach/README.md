# SPEACH

Native speech-to-text service. Same skeleton as CASE/PARAMS, new model only:
`facebook/omniASR-CTC-300M` in ONNX form (`OpenVoiceOS/omnilingual-asr-ctc-300m-onnx`).

Graph contract (verified against onnx-asr `omnilingual-ctc` + sherpa-onnx):

- input `x`: float32 `[1, num_samples]`, raw 16 kHz mono waveform
- output `logits`: float32 `[1, frames, 10288]`, unnormalized
- frame = 320 samples (20 ms), blank = 0 (`<s>`)
- shared vocabulary in `models/tokens.txt` (`<token> <id>`, token may be a space)
- greedy CTC decode: argmax, collapse repeats, drop blanks, strip

Two frontends feed the same graph:

- wav: parse -> mono -> linear resample to 16 kHz -> layer_norm over the clip
- opus: Opus RTP payloads / bare packets -> vendored libopus decoder
  (48 kHz mono) -> exact 3:1 decimation to 16 kHz -> layer_norm

No language conditioning: the CTC family transcribes whatever it hears.
Single-shot clips longer than 40 s are rejected; live legs are cut into
VAD segments (max 40 s each) instead.

## Live legs (resonus integration target)

Local replacement for the OpenAI transcription-only leg. Event shapes match
what `record/transcript.zig` consumes, so the gate side needs no new parser:

```bash
# 1. open a leg (opusPt = SDP-negotiated Opus payload type, 96..127)
curl -X POST http://localhost:8002/sessions -d '{"opusPt":111}'
# {"sessionId":"..."}

# 2. push audio: bare Opus packets or full RTP datagrams (base64),
#    seq/rtpStamp optional for bare frames (auto-increment from given start)
curl -X POST http://localhost:8002/segments -d '{
  "sessionId": "...",
  "frames": ["<base64 opus>", ...],
  "rtp": ["<base64 datagram>", ...],
  "seq": 1000, "rtpStamp": 48000,
  "loss": 2,
  "final": false
}'
# {"events":[
#   {"type":"conversation.item.input_audio_transcription.completed",
#    "transcript":"...","startMs":120,"endMs":1840,
#    "tokens":[{"t":"п","startMs":60},...]},
#   {"type":"conversation.item.input_audio_transcription.delta",
#    "delta":"..."}
# ]}

# 3. graceful stop (VAD grace closes the active phrase, 3 s deadline)
curl -X POST http://localhost:8002/sessions/stop -d '{"sessionId":"..."}'
# {"stopped":true}

# 4. poll; once ready to close returns the snapshot and drops the session
curl http://localhost:8002/sessions/<id>/events
# {"events":[...]}  — while open
# {"final":"... full text ..."}  — after stop + VAD grace
```

Segmentation is local energy VAD (replaces the OpenAI server-side VAD):
speech at RMS >= 400, release below 200, 60 ms attack, 1000 ms hangover,
1000 ms pre-roll. Tuned on `dictation-ru.opus` (345 frames, 63 below RMS 50).
Env overrides: `SPEACH_VAD_THRESHOLD`, `SPEACH_VAD_RELEASE`,
`SPEACH_VAD_ATTACK_FRAMES`, `SPEACH_VAD_SILENCE_MS`, `SPEACH_VAD_PREFIX_MS`
(defaults mirror the dictation preset in `gate/gateway.zig`).

`delta` is a re-decode of the open phrase tail (last 10 s); `completed`
fires per VAD-closed segment with token timestamps (frame = 20 ms).
Comfort-noise frames (<=3 bytes) are valid media but carry no speech;
sequence gaps should be reported via `"loss": N` for PLC synthesis.

## Single-shot (legacy)

```bash
zig build
SPEACH_MODEL=models/model.onnx SPEACH_TOKENS=models/tokens.txt zig-out/bin/speach test/en.wav
SPEACH_MODEL=models/model.onnx SPEACH_TOKENS=models/tokens.txt zig-out/bin/speach fixture.opus
```

```bash
curl -X POST http://localhost:8002/transcribe --data-binary @test/en.wav \
  -H 'content-type: audio/wav'
# {"text":"..."}
```

`GET /healthz` returns `{"ok":true}`.

## Models

`models/` is gitignored. Download:

```bash
cd models
curl -sL -o tokens.txt https://huggingface.co/OpenVoiceOS/omnilingual-asr-ctc-300m-onnx/resolve/main/tokens.txt
curl -sL -o model.onnx https://huggingface.co/OpenVoiceOS/omnilingual-asr-ctc-300m-onnx/resolve/main/model.onnx
# sample clips from the same repo: test_wavs/{en,de,es,fr}.wav -> test/
# live-leg fixture from resonus: tests/fixtures/dictation-ru.opus
```

Reference check (python, same decode rule):

```bash
pip install onnxruntime numpy soundfile
python3 test/reference.py test/en.wav --model models/model.onnx --tokens models/tokens.txt
```

Opus/native libs come from the wrappers tree (same per-target layout as
the ONNX Runtime wrapper): `../../wrappers/ai/onnxruntime/zig-out` and
`../../wrappers/protocols/opus/zig-out` (`zig build -Dall=true` over there).
The container copies both `.so` files into `/app/lib`.
