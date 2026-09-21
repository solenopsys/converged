#!/usr/bin/env python3
"""Reference check for the SPEACH native service: same graph, same decode.

Input : raw wav file (any rate/channels, resampled to 16 kHz mono).
Output: greedy CTC text (argmax, collapse repeats, drop blank 0, strip).

The native Zig service must print the same text for the same file.
Usage:
    python3 test/reference.py test/en.wav --model models/model.onnx --tokens models/tokens.txt
"""
from __future__ import annotations

import argparse
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), mode="rb") as f:
        data = f.readframes(f.getnframes())
        width, channels, rate = f.getsampwidth(), f.getnchannels(), f.getframerate()
        if width == 1:
            pcm = (np.frombuffer(data, dtype=np.uint8).astype(np.float32) - 128) / 128
        elif width == 2:
            pcm = np.frombuffer(data, dtype="<i2").astype(np.float32) / 32768
        elif width == 3:
            raw = np.frombuffer(data, dtype="V1").reshape(-1, 3)
            buf = np.zeros((raw.shape[0], 4), dtype="V1")
            buf[:, 1:] = raw
            pcm = buf.view(dtype="<i4").reshape(-1).astype(np.float32) / 8388608
        elif width == 4:
            pcm = np.frombuffer(data, dtype="<i4").astype(np.float32) / 2147483648
        else:
            raise ValueError(f"unsupported sampwidth: {width}")
        mono = pcm.reshape(-1, channels).mean(axis=1).astype(np.float32)
        return mono, rate


def resample(mono: np.ndarray, rate: int, target: int = 16000) -> np.ndarray:
    if rate == target:
        return mono
    ratio = target / rate
    out_len = int(len(mono) * ratio)
    pos = np.arange(out_len) / ratio
    idx = np.clip(pos.astype(np.int64), 0, len(mono) - 1)
    nxt = np.clip(idx + 1, 0, len(mono) - 1)
    frac = (pos - idx).astype(np.float32)
    return mono[idx] + (mono[nxt] - mono[idx]) * frac


def normalize(wave: np.ndarray) -> np.ndarray:
    mean = wave.mean()
    std = wave.std()
    if std < 1e-9:
        return wave - mean
    return (wave - mean) / std


def read_tokens(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    vocab: list[str] = [""] * len(lines)
    for line in lines:
        if not line:
            continue
        token, index = line.rsplit(" ", 1)
        vocab[int(index)] = token
    return vocab


def greedy(logits: np.ndarray, vocab: list[str], max_frames: int) -> str:
    best = logits.argmax(axis=-1)
    out: list[str] = []
    prev = 0
    for token_id in best[:max_frames]:
        token_id = int(token_id)
        if token_id != 0 and token_id != prev:
            out.append(vocab[token_id])
        prev = token_id
    return "".join(out).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("--model", required=True)
    ap.add_argument("--tokens", required=True)
    args = ap.parse_args()
    mono, rate = read_wav(Path(args.wav))
    wave16 = normalize(resample(mono, rate)).astype(np.float32)
    sess = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])
    (logits,) = sess.run(["logits"], {"x": wave16[None, :]})
    vocab = read_tokens(Path(args.tokens))
    print(greedy(logits[0], vocab, len(wave16) // 320 + 1))


if __name__ == "__main__":
    main()
