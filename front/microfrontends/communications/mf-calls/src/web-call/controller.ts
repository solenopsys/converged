/**
 * Public "call from website" controller owned by mf-calls.
 *
 * Imperative WebRTC ↔ resonus signaling for the public landing top-bar,
 * The shell invokes this through the `calls.web.start` action; signaling uses
 * the shared transport without leaking call protocol into front-core.
 *
 * Flow:
 *   getUserMedia → RTCPeerConnection offer → Fujin → Resonus → answer → media.
 * Recordings + transcripts land in the admin (CallsListView) once the gate ends
 * the session, so there is nothing extra to persist here.
 */
import { createEvent, createStore } from "effector";
import { authToken } from "front-core";
import { signalChannel } from "front-core/signal";
import { createMicCapture, type MicCapture } from "./mic-capture";

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
	 * Resonus session id returned atomically with the SDP answer.
	 */
	sessionId: string | null;
}

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

const LOG_PREFIX = "[web-call]";

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
let micCapture: MicCapture | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;

function endRemoteSession(): void {
	const sessionId = $webCall.getState().sessionId;
	if (sessionId) signalChannel.send("resonus", "call.hangup", { sessionId });
}

function setState(status: WebCallStatus, error: string | null = null): void {
	log("state", { status, error });
	const { warning, sessionId } = $webCall.getState();
	webCallStateChanged({ status, error, warning, sessionId });
}

function setWarning(warning: string | null): void {
	if (warning) warn("mic warning", warning);
	webCallWarningChanged(warning);
}

function clearStatsTimer(): void {
	if (!statsTimer) return;
	clearInterval(statsTimer);
	statsTimer = null;
}

function cleanup(): void {
	log("cleanup");
	clearStatsTimer();
	try {
		pc?.close();
	} catch {
		/* noop */
	}
	micCapture?.stop();
	setWarning(null);
	pc = null;
	micCapture = null;
}

function failCall(error: string, details?: unknown): void {
	logError("call failed", details === undefined ? error : { error, details });
	endRemoteSession();
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

export async function startWebCall(contextName?: string): Promise<void> {
	if (pc) {
		warn("start ignored, call is already in progress");
		return;
	}
	if (resetTimer) {
		clearTimeout(resetTimer);
		resetTimer = null;
	}

	webCallStateChanged({
		status: "connecting",
		error: null,
		warning: null,
		sessionId: null,
	});

	const callUser = ensureWebCallUser();
	const markConnected = () => {
		if ($webCall.getState().status !== "connected") setState("connected");
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

		const sdp = conn.localDescription?.sdp;
		if (!sdp) {
			throw new Error("Local SDP offer is empty");
		}
		const response = await signalChannel.request(
			"resonus",
			"call.offer",
			{ sdp, contextName, user: callUser },
			20_000,
		);
		const payload = asRecord(response.payload);
		const answerSdp = typeof payload?.sdp === "string" ? payload.sdp : "";
		if (response.name !== "call.answer" || !answerSdp) {
			throw new Error("Resonus answer did not contain SDP");
		}
		if (!response.sessionId)
			throw new Error("Resonus answer did not contain sessionId");
		webCallSessionDiscovered(response.sessionId);
		await conn.setRemoteDescription({ type: "answer", sdp: answerSdp });
		log("remote description set", { sessionId: response.sessionId });
	} catch (err) {
		logError("start failed", err);
		endRemoteSession();
		setState("error", errorMessage(err));
		cleanup();
		scheduleIdleReset();
	}
}

export function hangupWebCall(): void {
	log("hangup requested");
	endRemoteSession();
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
