# SPEACH

Native speech-to-text service. Same skeleton as CASE/PARAMS, new model only:
`facebook/omniASR-CTC-300M` in ONNX form (`OpenVoiceOS/omnilingual-asr-ctc-300m-onnx`).

Graph contract (verified against onnx-asr `omnilingual-ctc` + sherpa-onnx):

- input `x`: float32 `[1, num_samples]`, raw 16 kHz mono waveform
- output `logits`: float32 `[1, frames, 10288]`, unnormalized
- frame = 320 samples (20 ms), blank = 0 (`<s>`)
- shared vocabulary in `models/tokens.txt` (`<token> <id>`, token may be a space)
- greedy CTC decode: argmax, collapse repeats, drop blanks, strip

Frontend (same split as onnx-asr): wav parse -> mono -> linear resample to
16 kHz -> layer_norm over the clip. No language conditioning: the CTC family
transcribes whatever it hears. Clips longer than 40 s are rejected.

## Raw file

```bash
zig build
SPEACH_MODEL=models/model.onnx SPEACH_TOKENS=models/tokens.txt zig-out/bin/speach test/en.wav
```

## HTTP

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
```

Reference check (python, same decode rule):

```bash
pip install onnxruntime numpy soundfile
python3 test/reference.py test/en.wav --model models/model.onnx --tokens models/tokens.txt
```
