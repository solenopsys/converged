/**
 * Pure-TS EBML/WebM muxer for Opus audio.
 *
 * Packs a list of raw Opus frames (each one a 20 ms packet, as captured from
 * the WebRTC RTP stream by centimanus) into a valid WebM/Opus file that
 * browsers play natively and Web Audio `decodeAudioData` can decode.
 *
 * Timecodes are laid out SEQUENTIALLY at 20 ms per frame — exactly like the
 * original Go recorder (`int64(i * 20)`). Wall-clock arrival timestamps carry
 * network/scheduler jitter and, when used as block timecodes, make playback
 * choppy/garbled ("каша"). Each Opus frame is a fixed 20 ms slice, so a clean
 * sequential timeline reconstructs the audio faithfully.
 */

// EBML element IDs (full IDs with marker bits, as stored on the wire).
const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMESTAMP_SCALE = 0x2ad7b1;
const ID_MUXING_APP = 0x4d80;
const ID_WRITING_APP = 0x5741;
const ID_DURATION = 0x4489;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_NUMBER = 0xd7;
const ID_TRACK_UID = 0x73c5;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;
const ID_CODEC_PRIVATE = 0x63a2;
const ID_AUDIO = 0xe1;
const ID_SAMPLING_FREQ = 0xb5;
const ID_CHANNELS = 0x9f;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMESTAMP = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;

const ID_EBML_VERSION = 0x4286;
const ID_EBML_READ_VERSION = 0x42f7;
const ID_EBML_MAX_ID_LEN = 0x42f2;
const ID_EBML_MAX_SIZE_LEN = 0x42f3;
const ID_DOCTYPE = 0x4282;
const ID_DOCTYPE_VERSION = 0x4287;
const ID_DOCTYPE_READ_VERSION = 0x4285;

/** Each Opus frame is a fixed 20 ms slice. */
const FRAME_MS = 20;
/** Start a new cluster at least every ~30 s of audio. */
const CLUSTER_MAX_MS = 30_000;
const FRAMES_PER_CLUSTER = Math.floor(CLUSTER_MAX_MS / FRAME_MS);

export type WebMOpusOptions = {
  sampleRate?: number;
  channels?: number;
};

/** Encode an EBML element ID into its minimal big-endian byte form. */
function encodeId(id: number): Buffer {
  if (id <= 0xff) return Buffer.from([id]);
  if (id <= 0xffff) return Buffer.from([id >> 8, id & 0xff]);
  if (id <= 0xffffff) return Buffer.from([id >> 16, (id >> 8) & 0xff, id & 0xff]);
  return Buffer.from([id >>> 24, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff]);
}

/** Encode a length as an EBML variable-size integer (VINT). */
function encodeVintSize(size: number): Buffer {
  if (size < 0x7f) return Buffer.from([0x80 | size]);
  if (size < 0x3ffe) return Buffer.from([0x40 | (size >> 8), size & 0xff]);
  if (size < 0x1ffffe)
    return Buffer.from([0x20 | (size >> 16), (size >> 8) & 0xff, size & 0xff]);
  if (size < 0x0ffffffe)
    return Buffer.from([
      0x10 | (size >> 24),
      (size >> 16) & 0xff,
      (size >> 8) & 0xff,
      size & 0xff,
    ]);
  // 8-byte VINT for very large elements.
  const out = Buffer.alloc(8);
  out[0] = 0x01;
  for (let i = 1; i < 8; i++) {
    out[i] = (size / 2 ** (8 * (7 - i))) & 0xff;
  }
  return out;
}

/** A full element: id + VINT(size) + body. */
function elem(id: number, body: Buffer): Buffer {
  return Buffer.concat([encodeId(id), encodeVintSize(body.length), body]);
}

function uintElem(id: number, value: number, size: number): Buffer {
  const body = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    body[size - 1 - i] = (value / 2 ** (8 * i)) & 0xff;
  }
  return elem(id, body);
}

function f64Elem(id: number, value: number): Buffer {
  const body = Buffer.alloc(8);
  body.writeDoubleBE(value, 0);
  return elem(id, body);
}

function strElem(id: number, s: string): Buffer {
  return elem(id, Buffer.from(s, "utf8"));
}

/** 19-byte OpusHead identification header for CodecPrivate. */
function buildOpusHead(sampleRate: number, channels: number): Buffer {
  const h = Buffer.alloc(19);
  h.write("OpusHead", 0, "ascii");
  h[8] = 1; // version
  h[9] = channels; // channel count
  h.writeUInt16LE(0, 10); // pre-skip
  h.writeUInt32LE(sampleRate, 12); // input sample rate
  h.writeInt16LE(0, 16); // output gain
  h[18] = 0; // channel mapping family
  return h;
}

function buildEbmlHeader(): Buffer {
  const body = Buffer.concat([
    uintElem(ID_EBML_VERSION, 1, 1),
    uintElem(ID_EBML_READ_VERSION, 1, 1),
    uintElem(ID_EBML_MAX_ID_LEN, 4, 1),
    uintElem(ID_EBML_MAX_SIZE_LEN, 8, 1),
    strElem(ID_DOCTYPE, "webm"),
    uintElem(ID_DOCTYPE_VERSION, 4, 1),
    uintElem(ID_DOCTYPE_READ_VERSION, 2, 1),
  ]);
  return elem(ID_EBML, body);
}

function buildInfo(frameCount: number): Buffer {
  const durationMs = frameCount * FRAME_MS;
  const body = Buffer.concat([
    uintElem(ID_TIMESTAMP_SCALE, 1_000_000, 4), // 1 ms ticks
    strElem(ID_MUXING_APP, "ms-calls"),
    strElem(ID_WRITING_APP, "ms-calls"),
    f64Elem(ID_DURATION, durationMs),
  ]);
  return elem(ID_INFO, body);
}

function buildTracks(sampleRate: number, channels: number): Buffer {
  const audio = Buffer.concat([
    f64Elem(ID_SAMPLING_FREQ, sampleRate),
    uintElem(ID_CHANNELS, channels, 1),
  ]);
  const track = Buffer.concat([
    uintElem(ID_TRACK_NUMBER, 1, 1),
    uintElem(ID_TRACK_UID, 1, 1),
    uintElem(ID_TRACK_TYPE, 2, 1), // audio
    strElem(ID_CODEC_ID, "A_OPUS"),
    elem(ID_CODEC_PRIVATE, buildOpusHead(sampleRate, channels)),
    elem(ID_AUDIO, audio),
  ]);
  return elem(ID_TRACKS, elem(ID_TRACK_ENTRY, track));
}

function buildSimpleBlock(relMs: number, frame: Uint8Array): Buffer {
  const header = Buffer.from([
    0x81, // track number VINT = 1
    (relMs >> 8) & 0xff,
    relMs & 0xff,
    0x80, // keyframe flag
  ]);
  return elem(ID_SIMPLE_BLOCK, Buffer.concat([header, Buffer.from(frame)]));
}

function buildClusters(frames: Uint8Array[]): Buffer {
  const clusters: Buffer[] = [];
  for (let start = 0; start < frames.length; start += FRAMES_PER_CLUSTER) {
    const end = Math.min(start + FRAMES_PER_CLUSTER, frames.length);
    const baseMs = start * FRAME_MS;

    const blocks: Buffer[] = [uintElem(ID_CLUSTER_TIMESTAMP, baseMs, 4)];
    for (let i = start; i < end; i++) {
      const relMs = i * FRAME_MS - baseMs; // < CLUSTER_MAX_MS, fits in i16
      blocks.push(buildSimpleBlock(relMs, frames[i]));
    }
    clusters.push(elem(ID_CLUSTER, Buffer.concat(blocks)));
  }
  return Buffer.concat(clusters);
}

/**
 * Build a complete WebM/Opus file from sequential 20 ms Opus frames.
 * Returns `undefined` when there are no frames.
 */
export function writeWebMOpus(
  frames: Uint8Array[],
  opts: WebMOpusOptions = {},
): Uint8Array | undefined {
  if (frames.length === 0) return undefined;
  const sampleRate = opts.sampleRate ?? 48000;
  const channels = opts.channels ?? 1;

  // Segment with unknown size (0x01 + seven 0xFF), so we can stream clusters.
  const segmentUnknownSize = Buffer.from([
    0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  ]);

  return Buffer.concat([
    buildEbmlHeader(),
    encodeId(ID_SEGMENT),
    segmentUnknownSize,
    buildInfo(frames.length),
    buildTracks(sampleRate, channels),
    buildClusters(frames),
  ]);
}
