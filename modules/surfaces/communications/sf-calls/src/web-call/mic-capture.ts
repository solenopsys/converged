export interface MicCaptureOptions {
	echoCancellation?: boolean;

	noiseSuppression?: boolean;

	autoGainControl?: boolean;

	channelCount?: number;

	deviceId?: string;

	clipThreshold?: number;

	onLevel?: (level: { rms: number; peak: number }) => void;

	onClipChange?: (clipping: boolean) => void;
}

export interface MicCapture {
	readonly stream: MediaStream;

	readonly rawStream: MediaStream;

	isClipping(): boolean;

	setMuted(muted: boolean): void;

	stop(): void;
}

const DEFAULTS = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	channelCount: 1,
	clipThreshold: 0.98,
};

// Clip detection: fraction of full-scale samples per window to call it clipping,
// plus sustain windows to debounce (avoid flicker on natural speech peaks).
const CLIP_SAMPLE_RATIO = 0.01; // >1% of the window pinned at full scale
const CLIP_ON_WINDOWS = 3; // sustained windows before we warn
const CLIP_OFF_WINDOWS = 20; // longer quiet before we clear (hysteresis)
const TICK_MS = 100;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
	if (typeof window === "undefined") return null;
	const w = window as unknown as {
		AudioContext?: AudioContextCtor;
		webkitAudioContext?: AudioContextCtor;
	};
	return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export async function createMicCapture(
	options: MicCaptureOptions = {},
): Promise<MicCapture> {
	const opts = { ...DEFAULTS, ...options };

	const audioConstraints: MediaTrackConstraints = {
		autoGainControl: opts.autoGainControl,
		echoCancellation: opts.echoCancellation,
		noiseSuppression: opts.noiseSuppression,
		channelCount: { ideal: opts.channelCount },
	};
	if (options.deviceId) audioConstraints.deviceId = { exact: options.deviceId };

	const stream = await navigator.mediaDevices.getUserMedia({
		audio: audioConstraints,
		video: false,
	});

	const setMuted = (muted: boolean) => {
		for (const t of stream.getAudioTracks()) t.enabled = !muted;
	};

	// Read-only analyser tap. Only set up if someone is listening and Web Audio
	// exists; the track itself is sent to WebRTC untouched.
	const Ctor = getAudioContextCtor();
	const wantsMonitor = Boolean(options.onLevel || options.onClipChange);

	if (!Ctor || !wantsMonitor) {
		return {
			stream,
			rawStream: stream,
			isClipping: () => false,
			setMuted,
			stop: () => {
				for (const t of stream.getTracks()) t.stop();
			},
		};
	}

	const ctx = new Ctor();
	if (ctx.state === "suspended") {
		try {
			await ctx.resume();
		} catch {
			/* best effort */
		}
	}

	const source = ctx.createMediaStreamSource(stream);
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;
	// Connect source → analyser only (no path to destination): the analyser is a
	// read-only probe, the real audio still flows through the untouched track.
	source.connect(analyser);

	const buf = new Float32Array(analyser.fftSize);
	let clipping = false;
	let clipOn = 0;
	let clipOff = 0;

	const interval = setInterval(() => {
		analyser.getFloatTimeDomainData(buf);

		let peak = 0;
		let sumSq = 0;
		let atFullScale = 0;
		for (let i = 0; i < buf.length; i++) {
			const a = Math.abs(buf[i]);
			if (a > peak) peak = a;
			sumSq += buf[i] * buf[i];
			if (a >= opts.clipThreshold) atFullScale++;
		}

		const windowClipping = atFullScale / buf.length > CLIP_SAMPLE_RATIO;
		if (windowClipping) {
			clipOff = 0;
			if (!clipping && ++clipOn >= CLIP_ON_WINDOWS) {
				clipping = true;
				options.onClipChange?.(true);
			}
		} else {
			clipOn = 0;
			if (clipping && ++clipOff >= CLIP_OFF_WINDOWS) {
				clipping = false;
				options.onClipChange?.(false);
			}
		}

		options.onLevel?.({ rms: Math.sqrt(sumSq / buf.length), peak });
	}, TICK_MS);

	let stopped = false;
	return {
		stream,
		rawStream: stream,
		isClipping: () => clipping,
		setMuted,
		stop: () => {
			if (stopped) return;
			stopped = true;
			clearInterval(interval);
			try {
				source.disconnect();
				analyser.disconnect();
			} catch {
				/* noop */
			}
			for (const t of stream.getTracks()) t.stop();
			void ctx.close().catch(() => {});
		},
	};
}
