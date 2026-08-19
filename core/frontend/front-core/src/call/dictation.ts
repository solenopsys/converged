import { signalChannel } from "signal-channel";



export type DictationConfig = {
	fujinWsUrl: string;
	language: string;
};

export type DictationStatus = "idle" | "starting" | "listening" | "finishing" | "error";

type DictationSnapshot = {
	status: DictationStatus;

	text: string;
	error: string | null;
};

type StreamChunk = {
	type?: unknown;
	text?: unknown;
	sdp?: unknown;
	sessionId?: unknown;
};

const DEADLINE_MS = 300_000;
const STOP_DRAIN_MS = 150;
const DRAIN_TIMEOUT_MS = 15_000;

/// Capture starts on click, the transport is ready a few hundred milliseconds
/// later, and WebRTC cannot backfill: whatever is spoken in between is simply
/// never sent. So the peer connection is not fed the microphone directly — it
/// is fed this worklet, which queues every frame from the first one and stays
/// silent until "arm" (peer connected). From then on it emits one queued frame
/// per render quantum.
///
/// The queue is not free: a media track plays out in real time, so the backlog
/// built before "arm" is still owed at the end, and stop has to wait it out
/// ("seal" stops intake and reports "drained" once the queue is empty). That
/// wait is exactly as long as the connection setup was. It buys the opening
/// words, and it is the price of pushing audio through a live track at all.
const CAPTURE_WORKLET = `
const MAX_BLOCKS = 22500; // ~60 s at 48 kHz / 128 samples per quantum

class BufferedCapture extends AudioWorkletProcessor {
	constructor() {
		super();
		this.queue = [];
		this.armed = false;
		this.sealed = false;
		this.reported = false;
		this.port.onmessage = (event) => {
			if (event.data === "arm") this.armed = true;
			if (event.data === "seal") this.sealed = true;
		};
	}

	process(inputs, outputs) {
		const input = inputs[0] && inputs[0][0];
		if (input && !this.sealed && this.queue.length < MAX_BLOCKS) {
			this.queue.push(new Float32Array(input));
		}
		const output = outputs[0][0];
		if (!this.armed) {
			output.fill(0);
			// Stopped before the transport ever came up: nothing can be sent, so
			// release the waiter instead of holding it for the whole timeout.
			if (this.sealed && !this.reported) {
				this.reported = true;
				this.port.postMessage("drained");
			}
			return true;
		}
		const next = this.queue.shift();
		if (next) {
			output.set(next);
			return true;
		}
		output.fill(0);
		if (this.sealed && !this.reported) {
			this.reported = true;
			this.port.postMessage("drained");
		}
		return true;
	}
}

registerProcessor("buffered-capture", BufferedCapture);
`;

const listeners = new Set<(snapshot: DictationSnapshot) => void>();
const levelListeners = new Set<(level: number) => void>();


function log(stage: string, detail?: unknown) {
	if (detail === undefined) console.info(`[dictation] ${stage}`);
	else console.info(`[dictation] ${stage}`, detail);
}

let snapshot: DictationSnapshot = { status: "idle", text: "", error: null };
let connection: RTCPeerConnection | null = null;
let microphone: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let captureNode: AudioWorkletNode | null = null;
let levelFrame = 0;
let sessionId: string | null = null;
/// Set by cancelDictation. The start is still awaiting the reply stream at that
/// point, and everything it does next (setRemoteDescription on a closed peer)
/// would surface as a failure the user never caused.
let cancelled = false;

let committed = "";

let pending = "";

function publish(next: Partial<DictationSnapshot>) {
	snapshot = { ...snapshot, ...next };
	for (const listener of listeners) listener(snapshot);
}

function publishLevel(level: number) {
	for (const listener of levelListeners) listener(level);
}

function messageOf(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function joined() {
	if (!pending) return committed;
	return committed ? `${committed} ${pending}` : pending;
}

function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 2_000) {
	if (peer.iceGatheringState === "complete") return Promise.resolve();

	return new Promise<void>((resolve) => {
		const complete = () => {
			clearTimeout(timeout);
			peer.removeEventListener("icegatheringstatechange", onChange);
			resolve();
		};
		const onChange = () => {
			if (peer.iceGatheringState === "complete") complete();
		};
		const timeout = window.setTimeout(complete, timeoutMs);
		peer.addEventListener("icegatheringstatechange", onChange);
	});
}


/// Builds the track the peer connection actually sends: microphone -> queueing
/// worklet -> destination. Returns null when AudioWorklet is unavailable, and
/// the caller then falls back to the raw microphone track (older behaviour,
/// which drops whatever was said before the connection came up).
async function createBufferedCapture(source: MediaStreamAudioSourceNode, context: AudioContext) {
	try {
		const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
		try {
			await context.audioWorklet.addModule(url);
		} finally {
			URL.revokeObjectURL(url);
		}
	} catch (error) {
		console.warn("[dictation] buffered capture unavailable, sending the live microphone", error);
		return null;
	}

	const node = new AudioWorkletNode(context, "buffered-capture");
	const destination = context.createMediaStreamDestination();
	source.connect(node);
	node.connect(destination);
	captureNode = node;
	return destination.stream;
}

/// Hand the queued audio over to the transport. Everything recorded since the
/// click starts flowing from here, oldest frame first.
function armCapture() {
	captureNode?.port.postMessage("arm");
}

/// Stop intake and wait for the queue to reach the transport. Without this the
/// tail of a dictation — which is exactly as long as the connection setup took
/// — would be cut off by the session closing.
function drainCapture(): Promise<void> {
	const node = captureNode;
	if (!node) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const done = () => {
			window.clearTimeout(timeout);
			node.port.removeEventListener("message", onMessage);
			resolve();
		};
		const onMessage = (event: MessageEvent) => {
			if (event.data === "drained") done();
		};
		node.port.addEventListener("message", onMessage);
		node.port.start();
		const timeout = window.setTimeout(done, DRAIN_TIMEOUT_MS);
		node.port.postMessage("seal");
	});
}

function startLevelMeter(source: AudioNode, context: AudioContext) {
	const analyser = context.createAnalyser();
	analyser.fftSize = 1024;
	source.connect(analyser);
	const samples = new Float32Array(analyser.fftSize);

	const tick = () => {
		analyser.getFloatTimeDomainData(samples);
		let sum = 0;
		for (const sample of samples) sum += sample * sample;
		const rms = Math.sqrt(sum / samples.length);
		publishLevel(Math.min(1, rms * 6));
		levelFrame = requestAnimationFrame(tick);
	};
	levelFrame = requestAnimationFrame(tick);
}

function cleanup() {
	if (levelFrame) cancelAnimationFrame(levelFrame);
	levelFrame = 0;
	captureNode?.disconnect();
	captureNode = null;
	void audioContext?.close().catch(() => {});
	audioContext = null;
	publishLevel(0);
	try {
		connection?.close();
	} catch {

	}
	for (const track of microphone?.getTracks() ?? []) track.stop();
	connection = null;
	microphone = null;
	sessionId = null;
}

export function getDictationSnapshot() {
	return snapshot;
}

export function subscribeDictation(listener: (next: DictationSnapshot) => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}


export function subscribeDictationLevel(listener: (level: number) => void) {
	levelListeners.add(listener);
	return () => levelListeners.delete(listener);
}

export async function startDictation(config: DictationConfig) {
	if (connection) return;
	if (!navigator.mediaDevices?.getUserMedia) {
		publish({ status: "error", error: "Микрофон недоступен в этом браузере" });
		return;
	}

	committed = "";
	pending = "";
	cancelled = false;
	publish({ status: "starting", text: "", error: null });
	log("start requested", { language: config.language });
	globalThis.__FUJIN_WS_URL__ = config.fujinWsUrl;
	signalChannel.connect();

	try {
		microphone = await navigator.mediaDevices.getUserMedia({
			audio: {
				autoGainControl: true,
				echoCancellation: true,
				noiseSuppression: true,
				channelCount: { ideal: 1 },
			},
			video: false,
		});
		// Recording starts here, not when the transport is ready: the worklet
		// queues the microphone from this moment and releases it once the peer
		// connection is up (armCapture). The level meter runs from here too —
		// it now tells the truth, the words are being kept.
		const context = new AudioContext();
		audioContext = context;
		const micSource = context.createMediaStreamSource(microphone);
		startLevelMeter(micSource, context);
		const buffered = await createBufferedCapture(micSource, context);
		const outbound = buffered ?? microphone;

		const peer = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		connection = peer;
		const updateConnectionState = () => {
			log("connection state", peer.connectionState);
			if (peer.connectionState === "connected" && (snapshot.status === "starting" || snapshot.status === "listening")) {
				armCapture();
				publish({ status: "listening" });
			}
			if (peer.connectionState === "failed") {
				cleanup();
				publish({ status: "error", error: "Не удалось установить аудиосоединение" });
			}
		};
		peer.addEventListener("connectionstatechange", updateConnectionState);
		for (const track of outbound.getAudioTracks()) {
			peer.addTransceiver(track, { direction: "sendonly", streams: [outbound] });
		}

		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);
		await waitForIceGathering(peer);
		const sdp = peer.localDescription?.sdp;
		if (!sdp) throw new Error("Local SDP offer is empty");
		log("offer ready", { bytes: sdp.length });

		const stream = signalChannel.requestEnvelopeStream({
			kind: "request",
			requestId: crypto.randomUUID(),
			to: { target: "resonus", service: "resonus" },
			method: "dictation.start",
			codec: "json",
			deadlineMs: DEADLINE_MS,
			payload: { sdp, language: config.language },
		});

		for await (const reply of stream) {
			if (cancelled) break;
			const chunk = (reply.payload ?? {}) as StreamChunk;
			switch (chunk.type) {
				case "dictation.answer": {
					if (typeof chunk.sdp !== "string" || typeof chunk.sessionId !== "string") {
						throw new Error("Resonus не вернул SDP диктовки");
					}
					sessionId = chunk.sessionId;
					await peer.setRemoteDescription({ type: "answer", sdp: chunk.sdp });
					log("session up", { sessionId });
					updateConnectionState();
					break;
				}
				case "delta": {
					if (typeof chunk.text !== "string") break;
					pending += chunk.text;
					publish({ text: joined() });
					break;
				}
				case "segment": {
					if (typeof chunk.text !== "string") break;
					log("segment", chunk.text);
					committed = committed ? `${committed} ${chunk.text}` : chunk.text;
					pending = "";
					publish({ text: joined() });
					break;
				}
				case "final": {
					const final = typeof chunk.text === "string" ? chunk.text : "";
					const local = joined();
					log("final", { fromServer: final, local });
					const tail = pending.trim();
					const text = !final
						? local
						: tail && !final.endsWith(tail)
							? `${final} ${tail}`
							: final;
					publish({ status: "idle", text });
					break;
				}
			}
		}
	} catch (error) {
		if (cancelled) {
			log("start aborted by cancel");
			return;
		}
		console.warn("[dictation] failed", error);
		cleanup();
		publish({ status: "error", error: messageOf(error) });
		return;
	}
	log("closed");
	if (!cancelled) cleanup();
}


/// Abort a dictation that has not reached "listening" yet. Before the session
/// exists there is nothing for the gate to stop, so the local capture is simply
/// torn down; afterwards this is an ordinary stop.
export async function cancelDictation(): Promise<string> {
	if (!connection) return snapshot.text;
	if (sessionId) return stopDictation();
	log("cancelled before session");
	// Order matters: the flag must be set before the transport goes away, so the
	// pending start recognises the teardown as its own doing.
	cancelled = true;
	cleanup();
	publish({ status: "idle", text: "", error: null });
	return snapshot.text;
}

export async function stopDictation(): Promise<string> {
	if (!connection || !sessionId) return snapshot.text;
	const id = sessionId;

	for (const track of microphone?.getAudioTracks() ?? []) track.enabled = false;
	if (levelFrame) cancelAnimationFrame(levelFrame);
	levelFrame = 0;
	publishLevel(0);
	log("stop requested", { sessionId: id, pending });
	publish({ status: "finishing" });

	try {
		// The queue still holds everything the connection setup delayed — as much
		// audio as the setup took. Let it reach the gate before the session is
		// told to stop, otherwise the tail is cut off exactly like the head was.
		await drainCapture();
		// RTP and the OpenAI data channel are independent transports. Give the
		// final microphone packet a short head start before the server begins its
		// VAD grace period; this does not keep recording after the stop click.
		await new Promise<void>((resolve) => window.setTimeout(resolve, STOP_DRAIN_MS));
		await signalChannel.request("resonus", "dictation.stop", { sessionId: id }, 10_000);
	} catch (error) {
		console.warn("[dictation] stop failed", error);
		publish({ status: "error", error: messageOf(error) });
	}
	return snapshot.text;
}

declare global {
	var __FUJIN_WS_URL__: string | undefined;
}
