/**
 * Landing "call from website" controller.
 *
 * Imperative WebRTC ↔ centimanus signaling for the public landing top-bar,
 * using the same `/audio-gate/ws` contract as mf-calls' `useWebRTCCall`. Lives
 * in front-core (not mf-calls) so the landing — which depends on front-core but
 * not on mf-calls — can start a voice call straight from the header without a
 * dependency cycle.
 *
 * Flow:
 *   getUserMedia → RTCPeerConnection offer → WS /audio-gate/ws → answer → media.
 * Recordings + transcripts land in the admin (CallsListView) once the gate ends
 * the session, so there is nothing extra to persist here.
 */
import { createEvent, createStore } from "effector";
import { createMicCapture, type MicCapture } from "./mic-capture";
import { authToken } from "../controllers/auth-token";

export type WebCallStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "error"
	| "ended";

export interface WebCallState {
	status: WebCallStatus;
	error: string | null;
	/** Soft, non-fatal hint (e.g. microphone clipping). The call still runs. */
	warning: string | null;
	/**
	 * Gate session id of the current/last call, discovered via the gate's
	 * /user/<user> listing once the call connects. Consumers (e.g. the landing
	 * demo-call page) use it to load the transcript and recordings after the
	 * call ends. Null until discovered.
	 */
	sessionId: string | null;
}

type SignalingMessage = {
	type?: unknown;
	data?: unknown;
	sdp?: unknown;
	message?: unknown;
};

type AudioOutboundSnapshot = {
	id: string;
	bytesSent?: number;
	packetsSent?: number;
	retransmittedPacketsSent?: number;
	totalPacketSendDelay?: number;
};

type AudioSourceSnapshot = {
	id: string;
	audioLevel?: number;
	totalAudioEnergy?: number;
	totalSamplesDuration?: number;
};

/**
 * Fired by the top-bar / rail call icon. The payload is the single context KEY
 * (alias) the gate loads for a website call — NOT a phone number. Web calls are
 * not telephony: one context can back many SIP numbers, but the website call
 * always selects its context by this one key.
 */
export const webCallRequested = createEvent<string | undefined>();
export const webCallHangupRequested = createEvent();

const webCallStateChanged = createEvent<WebCallState>();
const webCallWarningChanged = createEvent<string | null>();
const webCallSessionDiscovered = createEvent<string>();

export const $webCall = createStore<WebCallState>({
	status: "idle",
	error: null,
	warning: null,
	sessionId: null,
})
	.on(webCallStateChanged, (_, next) => next)
	.on(webCallWarningChanged, (state, warning) => ({ ...state, warning }))
	.on(webCallSessionDiscovered, (state, sessionId) => ({
		...state,
		sessionId,
	}));

const AUDIO_GATE_BASE = "/audio-gate";
const LOG_PREFIX = "[web-call]";

function currentScope(): string {
	if (typeof window === "undefined") return "";
	return window.location.hostname;
}

function currentUser(): string {
	if (typeof window === "undefined") return "";
	const subject = authToken.payload()?.sub;
	if (subject) return subject;
	return window.sessionStorage.getItem("tempUserId") ?? "";
}

/**
 * Identity the gate binds the session to. Anonymous visitors get a generated
 * per-tab id persisted under the same `tempUserId` key mf-auth uses, so the
 * session stays discoverable via the gate's /user/<user> listing (an empty
 * user would collapse every visitor into the shared "anonymous" bucket).
 */
function ensureWebCallUser(): string {
	const existing = currentUser();
	if (existing) return existing;
	const generated = `web-${crypto.randomUUID()}`;
	window.sessionStorage.setItem("tempUserId", generated);
	return generated;
}

function wsCallUrl(contextName?: string): string {
	const proto =
		typeof window !== "undefined" && window.location.protocol === "https:"
			? "wss:"
			: "ws:";
	const host =
		typeof window !== "undefined" ? window.location.host : "localhost";
	const params = new URLSearchParams();
	const user = ensureWebCallUser();
	const scope = currentScope();
	if (contextName) params.set("context_name", contextName);
	if (scope) params.set("scope", scope);
	if (user) params.set("user", user);
	const qs = params.toString();
	return `${proto}//${host}${AUDIO_GATE_BASE}/ws${qs ? `?${qs}` : ""}`;
}

function log(message: string, details?: unknown): void {
	if (details === undefined) console.info(LOG_PREFIX, message);
	else console.info(LOG_PREFIX, message, details);
}

function warn(message: string, details?: unknown): void {
	if (details === undefined) console.warn(LOG_PREFIX, message);
	else console.warn(LOG_PREFIX, message, details);
}

function logError(message: string, details?: unknown): void {
	if (details === undefined) console.error(LOG_PREFIX, message);
	else console.error(LOG_PREFIX, message, details);
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

let pc: RTCPeerConnection | null = null;
let ws: WebSocket | null = null;
let micCapture: MicCapture | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
let answerTimer: ReturnType<typeof setTimeout> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;

function setState(status: WebCallStatus, error: string | null = null): void {
	log("state", { status, error });
	const { warning, sessionId } = $webCall.getState();
	webCallStateChanged({ status, error, warning, sessionId });
}

let sessionDiscoveryStarted = false;

/**
 * Resolve the gate session id of the just-connected call: the gate does not
 * echo it over signaling, but lists sessions per user. Newest entry wins. A
 * few retries cover the gate registering the session slightly after media
 * connects.
 */
async function discoverSession(user: string): Promise<void> {
	if (sessionDiscoveryStarted) return;
	sessionDiscoveryStarted = true;

	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			const resp = await fetch(
				`${AUDIO_GATE_BASE}/user/${encodeURIComponent(user)}`,
			);
			if (resp.ok) {
				const data = (await resp.json()) as { sessions?: string[] };
				const sessions = data.sessions ?? [];
				if (sessions.length > 0) {
					const sessionId = sessions[sessions.length - 1];
					log("session discovered", { sessionId });
					webCallSessionDiscovered(sessionId);
					return;
				}
			}
		} catch (err) {
			warn("session discovery failed", errorMessage(err));
		}
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}
	warn("session discovery gave up", { user });
}

function setWarning(warning: string | null): void {
	if (warning) warn("mic warning", warning);
	webCallWarningChanged(warning);
}

function clearAnswerTimer(): void {
	if (!answerTimer) return;
	clearTimeout(answerTimer);
	answerTimer = null;
}

function clearStatsTimer(): void {
	if (!statsTimer) return;
	clearInterval(statsTimer);
	statsTimer = null;
}

function cleanup(): void {
	log("cleanup");
	clearAnswerTimer();
	clearStatsTimer();
	try {
		ws?.close();
	} catch {
		/* noop */
	}
	try {
		pc?.close();
	} catch {
		/* noop */
	}
	micCapture?.stop();
	setWarning(null);
	ws = null;
	pc = null;
	micCapture = null;
}

function failCall(error: string, details?: unknown): void {
	logError("call failed", details === undefined ? error : { error, details });
	setState("error", error);
	cleanup();
	scheduleIdleReset();
}

/** Auto-hide the widget a few seconds after a call ends or fails. */
function scheduleIdleReset(): void {
	if (resetTimer) clearTimeout(resetTimer);
	resetTimer = setTimeout(() => {
		if (!pc) setState("idle");
		resetTimer = null;
	}, 4000);
}

async function waitForWsOpen(
	socket: WebSocket,
	timeoutMs: number,
): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;

	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanupListeners();
			reject(new Error("Audio gate timeout"));
		}, timeoutMs);

		const cleanupListeners = () => {
			clearTimeout(timeout);
			socket.removeEventListener("open", handleOpen);
			socket.removeEventListener("error", handleError);
		};

		const handleOpen = () => {
			cleanupListeners();
			resolve();
		};

		const handleError = () => {
			cleanupListeners();
			reject(new Error("Audio gate unreachable"));
		};

		socket.addEventListener("open", handleOpen);
		socket.addEventListener("error", handleError);
	});
}

async function waitForIceGatheringComplete(
	conn: RTCPeerConnection,
	timeoutMs = 2_000,
): Promise<void> {
	if (conn.iceGatheringState === "complete") return;

	log("waiting for ICE gathering", { timeoutMs });
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			warn("ICE gathering timeout, sending current local SDP", {
				iceGatheringState: conn.iceGatheringState,
			});
			cleanupListeners();
			resolve();
		}, timeoutMs);

		const cleanupListeners = () => {
			clearTimeout(timeout);
			conn.removeEventListener("icegatheringstatechange", handleChange);
		};

		const handleChange = () => {
			if (conn.iceGatheringState !== "complete") return;
			log("ICE gathering complete");
			cleanupListeners();
			resolve();
		};

		conn.addEventListener("icegatheringstatechange", handleChange);
	});
}

function numberField(
	record: Record<string, unknown>,
	field: string,
): number | undefined {
	return typeof record[field] === "number" ? record[field] : undefined;
}

function summarizeAudioStats(report: RTCStatsReport): {
	outbound: AudioOutboundSnapshot[];
	sources: AudioSourceSnapshot[];
} {
	const outbound: AudioOutboundSnapshot[] = [];
	const sources: AudioSourceSnapshot[] = [];

	report.forEach((stat) => {
		const record = asRecord(stat);
		if (!record) return;
		const type = typeof record.type === "string" ? record.type : "";
		const kind =
			typeof record.kind === "string"
				? record.kind
				: typeof record.mediaType === "string"
					? record.mediaType
					: "";
		const id = typeof record.id === "string" ? record.id : "";

		if (type === "outbound-rtp" && kind === "audio") {
			outbound.push({
				id,
				bytesSent: numberField(record, "bytesSent"),
				packetsSent: numberField(record, "packetsSent"),
				retransmittedPacketsSent: numberField(
					record,
					"retransmittedPacketsSent",
				),
				totalPacketSendDelay: numberField(record, "totalPacketSendDelay"),
			});
		}

		if (type === "media-source" && kind === "audio") {
			sources.push({
				id,
				audioLevel: numberField(record, "audioLevel"),
				totalAudioEnergy: numberField(record, "totalAudioEnergy"),
				totalSamplesDuration: numberField(record, "totalSamplesDuration"),
			});
		}
	});

	return { outbound, sources };
}

function startOutboundStatsLogging(conn: RTCPeerConnection): void {
	clearStatsTimer();
	statsTimer = setInterval(() => {
		void conn
			.getStats()
			.then((report) => {
				const snapshot = summarizeAudioStats(report);
				if (snapshot.outbound.length > 0 || snapshot.sources.length > 0) {
					log("audio outbound stats", snapshot);
				}
			})
			.catch((err) => {
				warn("audio stats failed", errorMessage(err));
			});
	}, 2_000);
}

function toIceCandidateInit(data: unknown): RTCIceCandidateInit | null {
	const record = asRecord(data);
	if (!record) return null;

	const candidate =
		typeof record.candidate === "string" ? record.candidate : "";
	if (!candidate) return null;

	const init: RTCIceCandidateInit = { candidate };
	if (typeof record.sdpMid === "string") init.sdpMid = record.sdpMid;
	if (typeof record.sdpMLineIndex === "number") {
		init.sdpMLineIndex = record.sdpMLineIndex;
	}
	if (typeof record.usernameFragment === "string") {
		init.usernameFragment = record.usernameFragment;
	}

	return init;
}

export async function startWebCall(contextName?: string): Promise<void> {
	if (pc) {
		warn("start ignored, call is already in progress");
		return;
	}
	if (resetTimer) {
		clearTimeout(resetTimer);
		resetTimer = null;
	}

	// Reset per-call session discovery so a new call re-resolves its own id
	// rather than reusing the previous call's session.
	sessionDiscoveryStarted = false;
	webCallStateChanged({
		status: "connecting",
		error: null,
		warning: null,
		sessionId: null,
	});

	const callUser = ensureWebCallUser();
	const markConnected = () => {
		if ($webCall.getState().status !== "connected") setState("connected");
		void discoverSession(callUser);
	};

	try {
		log("start requested", { contextName });

		log("requesting microphone");
		setWarning(null);
		const capture = await createMicCapture({
			onClipChange: (clipping) => {
				setWarning(
					clipping
						? "Микрофон перегружен — уменьшите его громкость в настройках системы"
						: null,
				);
			},
		});
		micCapture = capture;
		log("microphone stream acquired", {
			audioTracks: capture.stream.getAudioTracks().length,
			settings: capture.rawStream
				.getAudioTracks()
				.map((track) => track.getSettings()),
		});

		const conn = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		pc = conn;
		const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
		const addRemoteIceCandidate = async (
			candidate: RTCIceCandidateInit,
		): Promise<void> => {
			if (!conn.remoteDescription) {
				pendingRemoteCandidates.push(candidate);
				log("remote ICE candidate queued", {
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
				});
				return;
			}

			await conn.addIceCandidate(candidate);
			log("remote ICE candidate added", {
				sdpMid: candidate.sdpMid,
				sdpMLineIndex: candidate.sdpMLineIndex,
			});
		};
		const flushRemoteIceCandidates = async (): Promise<void> => {
			const queued = pendingRemoteCandidates.splice(0);
			for (const candidate of queued) {
				await addRemoteIceCandidate(candidate);
			}
		};
		const localStream = capture.stream;
		for (const track of localStream.getTracks()) {
			conn.addTrack(track, localStream);
		}
		log("peer connection created");
		startOutboundStatsLogging(conn);

		// Play the AI's audio track.
		conn.ontrack = (e) => {
			log("remote track received", {
				kind: e.track.kind,
				streams: e.streams.length,
			});
			const audioEl = new Audio();
			audioEl.srcObject = e.streams[0];
			audioEl.autoplay = true;
		};

		conn.onconnectionstatechange = () => {
			log("peer connection state", { state: conn.connectionState });
			if (conn.connectionState === "connected") markConnected();
			if (conn.connectionState === "failed") failCall("Peer connection failed");
		};

		conn.oniceconnectionstatechange = () => {
			log("ICE connection state", { state: conn.iceConnectionState });
			switch (conn.iceConnectionState) {
				case "connected":
				case "completed":
					markConnected();
					break;
				case "failed":
					failCall("ICE connection failed");
					break;
			}
		};

		conn.onicegatheringstatechange = () => {
			log("ICE gathering state", { state: conn.iceGatheringState });
		};

		conn.onsignalingstatechange = () => {
			log("signaling state", { state: conn.signalingState });
		};

		conn.onicecandidate = (event) => {
			if (!event.candidate) {
				log("local ICE candidate gathering ended");
				return;
			}
			log("local ICE candidate", {
				type: event.candidate.type,
				protocol: event.candidate.protocol,
				address: event.candidate.address,
				port: event.candidate.port,
			});
		};

		const offer = await conn.createOffer();
		log("SDP offer created", { sdpLength: offer.sdp.length });
		await conn.setLocalDescription(offer);
		await waitForIceGatheringComplete(conn);

		const url = wsCallUrl(contextName);
		log("opening websocket", { url });
		const socket = new WebSocket(url);
		ws = socket;

		socket.onmessage = async (event) => {
			log("websocket message", {
				bytes: typeof event.data === "string" ? event.data.length : undefined,
			});
			let msg: SignalingMessage;
			try {
				msg = JSON.parse(event.data as string) as SignalingMessage;
			} catch (err) {
				warn("ignored non-json websocket message", errorMessage(err));
				return;
			}
			log("signaling message", { type: msg.type });
			if (msg.type === "answer") {
				const data = asRecord(msg.data);
				const sdp =
					typeof data?.sdp === "string"
						? data.sdp
						: typeof msg.sdp === "string"
							? msg.sdp
							: "";
				if (!sdp) {
					failCall("Audio gate answer did not contain SDP", msg);
					return;
				}
				clearAnswerTimer();
				log("SDP answer received", { sdpLength: sdp.length });
				await conn.setRemoteDescription({ type: "answer", sdp });
				log("remote description set");
				await flushRemoteIceCandidates();
			} else if (msg.type === "ice-candidate") {
				const candidate = toIceCandidateInit(msg.data);
				if (!candidate) {
					warn("ignored invalid remote ICE candidate", msg.data);
					return;
				}
				try {
					await addRemoteIceCandidate(candidate);
				} catch (err) {
					logError("failed to add remote ICE candidate", {
						error: errorMessage(err),
						candidate,
					});
				}
			} else if (msg.type === "error") {
				const data = asRecord(msg.data);
				const message =
					(typeof data?.message === "string" && data.message) ||
					(typeof msg.message === "string" && msg.message) ||
					"Signaling error";
				failCall(message, msg);
			}
		};

		socket.onerror = (event) => {
			logError("websocket error", event);
		};

		socket.onclose = (event) => {
			log("websocket closed", {
				code: event.code,
				reason: event.reason,
				wasClean: event.wasClean,
			});
			if ($webCall.getState().status !== "error") setState("ended");
			cleanup();
			scheduleIdleReset();
		};

		await waitForWsOpen(socket, 10_000);
		log("websocket open, sending offer");

		const sdp = conn.localDescription?.sdp;
		if (!sdp) {
			throw new Error("Local SDP offer is empty");
		}
		socket.send(
			JSON.stringify({
				type: "offer",
				contextName,
				data: { type: "offer", sdp },
			}),
		);
		log("SDP offer sent", { sdpLength: sdp.length });

		answerTimer = setTimeout(() => {
			failCall("Audio gate answer timeout");
		}, 15_000);
	} catch (err) {
		logError("start failed", err);
		setState("error", errorMessage(err));
		cleanup();
		scheduleIdleReset();
	}
}

export function hangupWebCall(): void {
	log("hangup requested");
	cleanup();
	setState("ended");
	scheduleIdleReset();
}

webCallRequested.watch((contextName) => {
	void startWebCall(contextName);
});
webCallHangupRequested.watch(() => {
	hangupWebCall();
});
