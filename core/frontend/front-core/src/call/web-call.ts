import { signalChannel } from "signal-channel";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type WebsiteCallConfig = {
	fujinWsUrl: string;
	contextName: string;
};

export type WebsiteCallStatus = "idle" | "connecting" | "connected" | "error";

type WebsiteCallSnapshot = {
	status: WebsiteCallStatus;
	error: string | null;
};

export type WebsiteCallLevels = {
	user: number;
	assistant: number;
};

type SignalAnswer = {
	name?: string;
	sessionId?: string;
	payload?: unknown;
};

const listeners = new Set<(snapshot: WebsiteCallSnapshot) => void>();
const levelListeners = new Set<(levels: WebsiteCallLevels) => void>();
let snapshot: WebsiteCallSnapshot = { status: "idle", error: null };
let connection: RTCPeerConnection | null = null;
let microphone: MediaStream | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let remoteStream: MediaStream | null = null;
let sessionId: string | null = null;
let meterContext: AudioContext | null = null;
let userAnalyser: AnalyserNode | null = null;
let assistantAnalyser: AnalyserNode | null = null;
let meterFrame = 0;

function publish(status: WebsiteCallStatus, error: string | null = null) {
	snapshot = { status, error };
	for (const listener of listeners) listener(snapshot);
}

function publishLevels(levels: WebsiteCallLevels) {
	for (const listener of levelListeners) listener(levels);
}

function measuredLevel(analyser: AnalyserNode | null) {
	if (!analyser) return 0;
	const samples = new Float32Array(analyser.fftSize);
	analyser.getFloatTimeDomainData(samples);
	let sum = 0;
	for (const sample of samples) sum += sample * sample;
	return Math.min(1, Math.sqrt(sum / samples.length) * 6);
}

function startLevelMeter(stream: MediaStream) {
	try {
		meterContext = new AudioContext();
		userAnalyser = meterContext.createAnalyser();
		userAnalyser.fftSize = 512;
		meterContext.createMediaStreamSource(stream).connect(userAnalyser);
		const tick = () => {
			publishLevels({
				user: measuredLevel(userAnalyser),
				assistant: measuredLevel(assistantAnalyser),
			});
			meterFrame = requestAnimationFrame(tick);
		};
		meterFrame = requestAnimationFrame(tick);
	} catch (error) {
		// The diagram is optional. A browser that declines a second audio graph
		// must never make an otherwise valid WebRTC call fail.
		console.warn("[web-call] level meter unavailable", error);
		stopLevelMeter();
	}
}

function attachAssistantLevelMeter(stream: MediaStream) {
	if (!meterContext) return;
	try {
		assistantAnalyser = meterContext.createAnalyser();
		assistantAnalyser.fftSize = 512;
		meterContext.createMediaStreamSource(stream).connect(assistantAnalyser);
	} catch (error) {
		console.warn("[web-call] assistant level meter unavailable", error);
		assistantAnalyser = null;
	}
}

function stopLevelMeter() {
	if (meterFrame) cancelAnimationFrame(meterFrame);
	meterFrame = 0;
	void meterContext?.close().catch(() => {});
	meterContext = null;
	userAnalyser = null;
	assistantAnalyser = null;
	publishLevels({ user: 0, assistant: 0 });
}

function messageOf(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

/// Server-side refusals arrive as the Zig error name. They are the normal way a
/// call fails to start (a workspace without a call context is the common one),
/// so they get plain wording instead of surfacing an identifier nobody outside
/// the gate can read.
const REFUSAL_KEYS: Record<string, string> = {
	ContextRequired: "call.contextRequired",
	ContextUnavailable: "call.contextUnavailable",
	PolicyRejected: "call.policyRejected",
	PolicyProviderUnavailable: "call.policyProviderUnavailable",
	PolicyActionUnsupportedForWebRtc: "call.policyActionUnsupported",
	MissingOpenAIApiKey: "call.missingApiKey",
	DataChannelWrapperUnavailable: "call.dataChannelUnavailable",
};

function callErrorText(error: unknown) {
	const raw = messageOf(error);
	const key = REFUSAL_KEYS[raw];
	return key ? t(key) : raw;
}

function ensureCallUser() {
	const key = "minimal-web-call-user";
	const existing = sessionStorage.getItem(key);
	if (existing) return existing;
	const value = `web-${crypto.randomUUID()}`;
	sessionStorage.setItem(key, value);
	return value;
}

function waitForIceGathering(connection: RTCPeerConnection, timeoutMs = 2_000) {
	if (connection.iceGatheringState === "complete") return Promise.resolve();

	return new Promise<void>((resolve) => {
		const complete = () => {
			clearTimeout(timeout);
			connection.removeEventListener("icegatheringstatechange", onChange);
			resolve();
		};
		const onChange = () => {
			if (connection.iceGatheringState === "complete") complete();
		};
		const timeout = window.setTimeout(complete, timeoutMs);
		connection.addEventListener("icegatheringstatechange", onChange);
	});
}

function cleanup() {
	stopLevelMeter();
	try {
		connection?.close();
	} catch {
		/* Connection may already be closed. */
	}
	for (const track of microphone?.getTracks() ?? []) track.stop();
	remoteAudio?.pause();
	if (remoteAudio) remoteAudio.srcObject = null;
	connection = null;
	microphone = null;
	remoteAudio = null;
	remoteStream = null;
	sessionId = null;
}

export function getWebsiteCallSnapshot() {
	return snapshot;
}

export function subscribeWebsiteCall(listener: (next: WebsiteCallSnapshot) => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function subscribeWebsiteCallLevels(
	listener: (levels: WebsiteCallLevels) => void,
) {
	levelListeners.add(listener);
	return () => levelListeners.delete(listener);
}

export async function startWebsiteCall(config: WebsiteCallConfig) {
	if (connection) return;
	if (!navigator.mediaDevices?.getUserMedia) {
		publish("error", "Microphone access is unavailable in this browser");
		return;
	}

	publish("connecting");
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
		const peer = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		connection = peer;
		for (const track of microphone.getTracks()) peer.addTrack(track, microphone);

		peer.ontrack = (event) => {
			remoteStream = event.streams[0] ?? null;
			remoteAudio = new Audio();
			remoteAudio.autoplay = true;
			remoteAudio.srcObject = remoteStream;
			if (remoteStream) attachAssistantLevelMeter(remoteStream);
			void remoteAudio.play().catch(() => {});
		};
		peer.onconnectionstatechange = () => {
			if (peer.connectionState === "connected") {
				publish("connected");
				if (microphone && !meterContext) {
					startLevelMeter(microphone);
					if (remoteStream) attachAssistantLevelMeter(remoteStream);
				}
			}
			if (peer.connectionState === "failed") {
				cleanup();
				publish("error", "Voice connection failed");
			}
		};

		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);
		await waitForIceGathering(peer);
		const sdp = peer.localDescription?.sdp;
		if (!sdp) throw new Error("Local SDP offer is empty");

		const answer = (await signalChannel.request(
			"resonus",
			"call.offer",
			{ sdp, contextName: config.contextName, user: ensureCallUser() },
			20_000,
		)) as SignalAnswer;
		const payload = answer.payload as { sdp?: unknown } | undefined;
		if (answer.name !== "call.answer" || typeof payload?.sdp !== "string") {
			throw new Error("Resonus answer did not contain SDP");
		}
		if (!answer.sessionId) throw new Error("Resonus answer did not contain session id");

		sessionId = answer.sessionId;
		await peer.setRemoteDescription({ type: "answer", sdp: payload.sdp });
	} catch (error) {
		// Without this the handset just silently fails to connect: the reason
		// only ever existed in the gate's log.
		console.warn("[web-call] failed", error);
		cleanup();
		publish("error", callErrorText(error));
	}
}

export function hangupWebsiteCall() {
	if (sessionId) signalChannel.send("resonus", "call.hangup", { sessionId });
	cleanup();
	publish("idle");
}

declare global {
	var __FUJIN_WS_URL__: string | undefined;
}
