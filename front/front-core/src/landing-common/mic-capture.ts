/**
 * Shared microphone capture with clipping/level monitoring.
 *
 * Deliberately thin. The browser's own WebRTC audio processing
 * (`autoGainControl` / `echoCancellation` / `noiseSuppression`, i.e. Chrome's
 * AGC2 + AEC3) already does gain normalization, echo and noise removal — and
 * does it better than anything we'd hand-roll. We keep it ON and send the
 * microphone track to WebRTC **directly**; routing it through a Web Audio graph
 * would risk degrading echo cancellation for no real gain.
 *
 * The one thing the browser does NOT give us is a signal that the input is
 * *clipping*. A "hot" mic (OS/hardware input gain too high) clips at the ADC
 * before any processing; the resulting flat-topped audio is unintelligible to
 * ASR (this was the real "LLM hears me but doesn't understand" cause). No
 * built-in AGC can recover ADC clipping — analog gain control (the only thing
 * that could prevent it) is unreliable, especially on Linux/PulseAudio — and a
 * post-capture GainNode can't un-clip it either. So the only effective fix is to
 * **detect clipping and tell the user to lower their mic level**.
 *
 * That's all this module adds: a read-only `AnalyserNode` tap (the same pattern
 * as `useWebRTCCall`) for clip detection + a level meter. Framework-agnostic so
 * the landing (`web-call.ts`) and mf-calls both reuse it. Send `capture.stream`
 * to `RTCPeerConnection.addTrack`; call `capture.stop()` on teardown.
 */

export interface MicCaptureOptions {
	/** Browser echo cancellation. Default true. */
	echoCancellation?: boolean;
	/** Browser noise suppression. Default true. */
	noiseSuppression?: boolean;
	/** Browser automatic gain control. Default true (let the browser normalize). */
	autoGainControl?: boolean;
	/** Capture channel count. Default 1 (mono — what the gate/LLM expects). */
	channelCount?: number;
	/** Specific input device. Default: system default. */
	deviceId?: string;
	/** Sample magnitude treated as "at full scale". Default 0.98. */
	clipThreshold?: number;
	/** Per-tick UI metering, linear 0..1. */
	onLevel?: (level: { rms: number; peak: number }) => void;
	/**
	 * Fired when input-stage clipping starts/stops. `true` means the mic is
	 * pinned at full scale — prompt the user to lower their microphone level
	 * (nothing in the browser or here can un-clip it).
	 */
	onClipChange?: (clipping: boolean) => void;
}

export interface MicCapture {
	/** Microphone stream to send to `RTCPeerConnection.addTrack`. */
	readonly stream: MediaStream;
	/** Alias of `stream`; kept so callers can read raw track settings. */
	readonly rawStream: MediaStream;
	/** True while the input is hard-clipping (user must lower mic gain). */
	isClipping(): boolean;
	/** Mute/unmute the outgoing audio without dropping the stream. */
	setMuted(muted: boolean): void;
	/** Stop monitoring and the microphone tracks. */
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

/**
 * Open the mic (browser processing ON) and start read-only clip/level
 * monitoring. Must be called from a user gesture so the audio context resumes.
 */
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
