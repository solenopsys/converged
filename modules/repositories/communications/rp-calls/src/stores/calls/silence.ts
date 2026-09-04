


const FRAME_MS = 20;

export type SilenceTrimConfig = {

  absSilenceBytes: number;

  loudPercentile: number;

  loudRatio: number;

  maxGapFrames: number;
};

export const DEFAULT_SILENCE_TRIM: SilenceTrimConfig = {
  absSilenceBytes: 10,
  loudPercentile: 0.9,
  loudRatio: 0.35,
  maxGapFrames: Math.round(1000 / FRAME_MS), // 1 s
};


export function silenceTrimConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): SilenceTrimConfig {
  const num = (key: string, fallback: number): number => {
    const raw = env[key];
    if (raw == null || raw.trim() === "") return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? v : fallback;
  };
  const maxGapMs = num("CALL_AUDIO_MAX_PAUSE_MS", 1000);
  return {
    absSilenceBytes: num("CALL_AUDIO_SILENCE_BYTES", DEFAULT_SILENCE_TRIM.absSilenceBytes),
    loudPercentile: num("CALL_AUDIO_LOUD_PERCENTILE", DEFAULT_SILENCE_TRIM.loudPercentile),
    loudRatio: num("CALL_AUDIO_LOUD_RATIO", DEFAULT_SILENCE_TRIM.loudRatio),
    maxGapFrames: Math.max(0, Math.round(maxGapMs / FRAME_MS)),
  };
}


function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(p * (sorted.length - 1))),
  );
  return sorted[idx];
}


export function trimSilence(
  frames: Uint8Array[],
  cfg: SilenceTrimConfig = DEFAULT_SILENCE_TRIM,
): Uint8Array[] {
  if (frames.length === 0) return frames;

  const sizes = frames.map((f) => f.byteLength);
  const loudRef = percentile(sizes, cfg.loudPercentile);
  const threshold = Math.max(cfg.absSilenceBytes, loudRef * cfg.loudRatio);
  const isQuiet = (i: number): boolean => sizes[i] <= threshold;

  let firstLoud = -1;
  let lastLoud = -1;
  for (let i = 0; i < frames.length; i++) {
    if (!isQuiet(i)) {
      if (firstLoud === -1) firstLoud = i;
      lastLoud = i;
    }
  }
  // Nothing loud anywhere — keep the recording as-is.
  if (firstLoud === -1) return frames;

  const kept: Uint8Array[] = [];
  let gap = 0;
  for (let i = firstLoud; i <= lastLoud; i++) {
    if (isQuiet(i)) {
      if (gap < cfg.maxGapFrames) {
        kept.push(frames[i]);
        gap += 1;
      }
      // else: drop this quiet frame, the pause is already at the cap.
    } else {
      kept.push(frames[i]);
      gap = 0;
    }
  }
  return kept;
}
