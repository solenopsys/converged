/**
 * StereoCallPlayer
 *
 * Plays a call as a single stereo recording: the caller (user) panned hard
 * left, the AI panned hard right, so you hear the whole conversation in one
 * player. Both per-track WebM/Opus recordings are decoded with Web Audio,
 * mixed into one stereo PCM buffer, and re-encoded as a WAV blob so a plain
 * <audio> element gives us free play/pause/seek. A single canvas draws both
 * waveforms (user on top, AI on the bottom) under one shared playhead.
 *
 * Note: each track is stored as its own compacted timeline, so alignment is
 * best-effort — both tracks span ~the full call, which keeps them roughly in
 * sync without per-frame wall-clock remuxing.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

type StereoCallPlayerProps = {
  userSrc: string | null;
  aiSrc: string | null;
  userColor?: string;
  aiColor?: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const PEAK_BARS = 400;

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Fetch + decode a recording URL to its first (mono) channel. */
async function decodeMono(ctx: AudioContext, src: string | null): Promise<Float32Array | null> {
  if (!src) return null;
  const resp = await fetch(src);
  if (!resp.ok) return null;
  const buf = await resp.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buf);
  return decoded.getChannelData(0);
}

/** Downsample to `targetLen` bars, each = max abs amplitude in its window. */
function buildPeaks(data: Float32Array | null, targetLen: number): Float32Array | null {
  if (!data || data.length === 0) return null;
  const blockSize = Math.max(1, Math.floor(data.length / targetLen));
  const peaks = new Float32Array(targetLen);
  for (let i = 0; i < targetLen; i++) {
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(data[start + j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

/** Interleave two mono channels into a 16-bit PCM stereo WAV blob. */
function encodeStereoWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Blob {
  const frames = Math.max(left.length, right.length);
  const blockAlign = 2 /*ch*/ * 2 /*bytes*/;
  const dataSize = frames * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(off + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    off += 4;
  }
  return new Blob([buf], { type: "audio/wav" });
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  userPeaks: Float32Array | null,
  aiPeaks: Float32Array | null,
  progress: number,
  userColor: string,
  aiColor: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const mid = height / 2;
  const barW = 2;
  const gap = 1;
  const step = barW + gap;
  const count = Math.floor(width / step);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff10";
  ctx.fillRect(0, mid - 0.5, width, 1);

  for (let i = 0; i < count; i++) {
    const played = i / count <= progress;
    const x = i * step;
    if (userPeaks) {
      const u = userPeaks[Math.floor((i / count) * userPeaks.length)] * (mid - 2);
      ctx.fillStyle = played ? userColor : userColor + "44";
      ctx.fillRect(x, mid - u, barW, u || 1);
    }
    if (aiPeaks) {
      const a = aiPeaks[Math.floor((i / count) * aiPeaks.length)] * (mid - 2);
      ctx.fillStyle = played ? aiColor : aiColor + "44";
      ctx.fillRect(x, mid, barW, a || 1);
    }
  }
}

export const StereoCallPlayer: React.FC<StereoCallPlayerProps> = ({
  userSrc,
  aiSrc,
  userColor = "#3b82f6",
  aiColor = "#22c55e",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const userPeaksRef = useRef<Float32Array | null>(null);
  const aiPeaksRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number>(0);
  const wavUrlRef = useRef<string | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const redraw = useCallback(
    (prog: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawWaveform(canvas, userPeaksRef.current, aiPeaksRef.current, prog, userColor, aiColor);
    },
    [userColor, aiColor],
  );

  // ── Decode both tracks, mix to a stereo WAV ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError(null);

    (async () => {
      try {
        const ac = new AudioContext();
        const [user, ai] = await Promise.all([
          decodeMono(ac, userSrc),
          decodeMono(ac, aiSrc),
        ]);
        if (cancelled) return;
        if (!user && !ai) throw new Error("no audio");

        // If a track is missing, center the other one across both channels.
        const left = user ?? ai!;
        const right = ai ?? user!;
        const sampleRate = ac.sampleRate;

        userPeaksRef.current = buildPeaks(user, PEAK_BARS);
        aiPeaksRef.current = buildPeaks(ai, PEAK_BARS);

        const wav = encodeStereoWav(left, right, sampleRate);
        const url = URL.createObjectURL(wav);
        if (wavUrlRef.current) URL.revokeObjectURL(wavUrlRef.current);
        wavUrlRef.current = url;
        if (audioRef.current) audioRef.current.src = url;

        setDuration(Math.max(left.length, right.length) / sampleRate);
        setProgress(0);
        setCurrentTime(0);
        setLoadState("ready");
        ac.close();
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoadState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userSrc, aiSrc]);

  useEffect(() => {
    if (loadState === "ready") redraw(0);
  }, [loadState, redraw]);

  // Revoke the WAV URL on unmount.
  useEffect(
    () => () => {
      if (wavUrlRef.current) URL.revokeObjectURL(wavUrlRef.current);
    },
    [],
  );

  // ── RAF playhead ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        const prog = audio.duration ? audio.currentTime / audio.duration : 0;
        setProgress(prog);
        setCurrentTime(audio.currentTime);
        redraw(prog);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, redraw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !audio.duration) return;
    const rect = canvas.getBoundingClientRect();
    const newProg = (e.clientX - rect.left) / rect.width;
    audio.currentTime = newProg * audio.duration;
    setProgress(newProg);
    setCurrentTime(audio.currentTime);
    redraw(newProg);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Legend + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ backgroundColor: userColor + "22", color: userColor }}
          >
            You · L
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ backgroundColor: aiColor + "22", color: aiColor }}
          >
            AI · R
          </span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={loadState !== "ready"}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 bg-foreground/10 hover:bg-foreground/20"
        >
          {loadState === "loading" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : playing ? (
            <Pause size={15} />
          ) : (
            <Play size={15} />
          )}
        </button>

        {loadState === "error" ? (
          <div className="flex-1 text-xs text-red-400">{error}</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={560}
            height={64}
            onClick={handleCanvasClick}
            className="flex-1 rounded cursor-pointer"
            style={{ height: 64 }}
          />
        )}
      </div>

      <audio
        ref={audioRef}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
          redraw(1);
        }}
        preload="auto"
        style={{ display: "none" }}
      />
    </div>
  );
};
