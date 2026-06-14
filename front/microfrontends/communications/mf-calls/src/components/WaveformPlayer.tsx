/**
 * WaveformPlayer
 *
 * Fetches the audio file, decodes it with Web Audio API, draws the waveform
 * on a <canvas>, and animates a playhead while the audio plays.
 * No extra dependencies — pure Web Audio + Canvas.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

type WaveformPlayerProps = {
  src: string;
  label: string;
  color?: string;       // e.g. "#3b82f6" (blue) or "#22c55e" (green)
  trackColor?: string;  // unfilled part
};

type LoadState = "idle" | "loading" | "ready" | "error";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Downsample PCM data to `targetLen` bars, each bar = max abs in window */
function buildPeaks(channelData: Float32Array, targetLen: number): Float32Array {
  const blockSize = Math.floor(channelData.length / targetLen);
  const peaks = new Float32Array(targetLen);
  for (let i = 0; i < targetLen; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(channelData[i * blockSize + j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  progress: number,  // 0..1
  fillColor: string,
  dimColor: string,
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

  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * peaks.length);
    const amp = peaks[idx] * mid * 0.9;
    const played = i / count <= progress;
    ctx.fillStyle = played ? fillColor : dimColor;
    ctx.fillRect(i * step, mid - amp, barW, amp * 2 || 1);
  }
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  src,
  label,
  color = "#3b82f6",
  trackColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef  = useRef<HTMLAudioElement>(null);
  const peaksRef  = useRef<Float32Array | null>(null);
  const rafRef    = useRef<number>(0);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dim = trackColor ?? color + "33"; // 20% opacity fallback

  // ── Decode audio once ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError(null);

    (async () => {
      try {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const ac = new AudioContext();
        const decoded = await ac.decodeAudioData(buf);
        if (cancelled) return;
        peaksRef.current = buildPeaks(decoded.getChannelData(0), 400);
        setDuration(decoded.duration);
        setLoadState("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoadState("error");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  // ── Draw on canvas whenever peaks / progress / size change ────────────────
  const redraw = useCallback((prog: number) => {
    const canvas = canvasRef.current;
    const peaks  = peaksRef.current;
    if (!canvas || !peaks) return;
    drawWaveform(canvas, peaks, prog, color, dim);
  }, [color, dim]);

  useEffect(() => {
    if (loadState === "ready") redraw(progress);
  }, [loadState, redraw]);   // initial draw

  // ── RAF loop while playing ─────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const prog = audio.duration ? audio.currentTime / audio.duration : 0;
      setProgress(prog);
      setCurrentTime(audio.currentTime);
      redraw(prog);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, redraw]);

  // ── Click on canvas → seek ─────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio  = audioRef.current;
    if (!canvas || !audio || !audio.duration) return;
    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const newProg = x / rect.width;
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

  const handleEnded = () => {
    setPlaying(false);
    setProgress(1);
    redraw(1);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ backgroundColor: color + "22", color }}
        >
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Waveform + play button row */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={loadState !== "ready"}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
          style={{ backgroundColor: color + "22", color }}
        >
          {loadState === "loading" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : playing ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
        </button>

        {loadState === "error" ? (
          <div className="flex-1 text-xs text-red-400">{error}</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={560}
            height={48}
            onClick={handleCanvasClick}
            className="flex-1 min-w-0 w-full rounded cursor-pointer"
            style={{ height: 48 }}
          />
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        onEnded={handleEnded}
        preload="none"
        style={{ display: "none" }}
      />
    </div>
  );
};
