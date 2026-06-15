/**
 * Silence trimming for the on-demand call audio.
 *
 * The gate records one raw Opus packet per 20 ms straight off the WebRTC
 * stream — including the dead air at the start of a call (the few seconds
 * before anyone speaks) and pauses mid-conversation. webm.ts then lays those
 * packets out back-to-back at 20 ms each, so that dead air becomes real
 * playback time: the listener sits through several seconds of nothing, and the
 * waveform is dominated by flat silence with the actual speech squashed into a
 * sliver.
 *
 * We don't decode Opus here (no decoder is linked anywhere in this path), so
 * energy is inferred from the *packet size*: Opus is VBR, and near-silence /
 * low-level background noise encodes into much smaller packets than speech.
 * Rather than a fixed byte threshold (fragile across bitrates), the threshold
 * is derived from the call's own loud frames — robust against steady noise.
 *
 * With each frame classified quiet/loud we:
 *   1. drop leading and trailing quiet frames entirely, and
 *   2. collapse any internal run of quiet frames to at most ~1 s,
 * so a pause is never longer than the configured cap.
 */

/** Each Opus packet off the WebRTC stream is a fixed 20 ms slice. */
const FRAME_MS = 20;

export type SilenceTrimConfig = {
  /** Packets this small (bytes) are always quiet — DTX / comfort-noise. */
  absSilenceBytes: number;
  /** Percentile (0..1) of packet sizes taken as the "loud" reference. */
  loudPercentile: number;
  /** A packet is quiet if smaller than loudReference * loudRatio. */
  loudRatio: number;
  /** Max consecutive quiet frames kept inside the audio (the pause cap). */
  maxGapFrames: number;
};

export const DEFAULT_SILENCE_TRIM: SilenceTrimConfig = {
  absSilenceBytes: 10,
  loudPercentile: 0.9,
  loudRatio: 0.35,
  maxGapFrames: Math.round(1000 / FRAME_MS), // 1 s
};

/** Read the trim config from env, falling back to the defaults. */
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

/** Linear-interpolated percentile of an unsorted numeric array. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

/**
 * Trim dead air from a sequence of Opus frames (chronological order).
 * Returns the kept subset, in order. Frames are compared by byte length only.
 *
 * If the call has no loud frames at all (entirely silent recording), the input
 * is returned unchanged rather than emptied — we'd rather play quiet audio than
 * nothing.
 */
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
