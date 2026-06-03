/**
 * Landing "call from website" controller.
 *
 * Imperative WebRTC ↔ llm-audio-gate signaling for the public landing top-bar,
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

export type WebCallStatus = "idle" | "connecting" | "connected" | "error" | "ended";

export interface WebCallState {
	status: WebCallStatus;
	error: string | null;
}

/** Fired by the top-bar call icon. Optional `user` keys the gate's AI context. */
export const webCallRequested = createEvent<string | undefined>();
export const webCallHangupRequested = createEvent();

const webCallStateChanged = createEvent<WebCallState>();

export const $webCall = createStore<WebCallState>({ status: "idle", error: null }).on(
	webCallStateChanged,
	(_, next) => next,
);

const AUDIO_GATE_BASE = "/audio-gate";

function wsCallUrl(user?: string): string {
	const proto =
		typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
	const host = typeof window !== "undefined" ? window.location.host : "localhost";
	const qs = user ? `?user=${encodeURIComponent(user)}` : "";
	return `${proto}//${host}${AUDIO_GATE_BASE}/ws${qs}`;
}

let pc: RTCPeerConnection | null = null;
let ws: WebSocket | null = null;
let stream: MediaStream | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

function setState(status: WebCallStatus, error: string | null = null): void {
	webCallStateChanged({ status, error });
}

function cleanup(): void {
	try { ws?.close(); } catch { /* noop */ }
	try { pc?.close(); } catch { /* noop */ }
	stream?.getTracks().forEach((t) => t.stop());
	ws = null;
	pc = null;
	stream = null;
}

/** Auto-hide the widget a few seconds after a call ends or fails. */
function scheduleIdleReset(): void {
	if (resetTimer) clearTimeout(resetTimer);
	resetTimer = setTimeout(() => {
		if (!pc) setState("idle");
		resetTimer = null;
	}, 4000);
}

export async function startWebCall(user?: string): Promise<void> {
	if (pc) return; // a call is already in progress
	if (resetTimer) {
		clearTimeout(resetTimer);
		resetTimer = null;
	}

	try {
		setState("connecting");

		stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

		const conn = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		pc = conn;
		stream.getTracks().forEach((t) => conn.addTrack(t, stream!));

		// Play the AI's audio track.
		conn.ontrack = (e) => {
			const audioEl = new Audio();
			audioEl.srcObject = e.streams[0];
			audioEl.autoplay = true;
		};

		conn.oniceconnectionstatechange = () => {
			switch (conn.iceConnectionState) {
				case "connected":
				case "completed":
					setState("connected");
					break;
				case "failed":
					setState("error", "ICE connection failed");
					break;
			}
		};

		const offer = await conn.createOffer();
		await conn.setLocalDescription(offer);

		const socket = new WebSocket(wsCallUrl(user));
		ws = socket;

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("Audio gate timeout")), 10_000);
			socket.onopen = () => { clearTimeout(timeout); resolve(); };
			socket.onerror = () => {
				clearTimeout(timeout);
				reject(new Error("Audio gate unreachable"));
			};
		});

		socket.send(JSON.stringify({ type: "offer", sdp: conn.localDescription!.sdp }));

		socket.onmessage = async (event) => {
			let msg: any;
			try {
				msg = JSON.parse(event.data as string);
			} catch {
				return;
			}
			if (msg.type === "answer") {
				const sdp: string = msg.data?.sdp ?? msg.sdp;
				await conn.setRemoteDescription({ type: "answer", sdp });
			} else if (msg.type === "error") {
				setState("error", msg.data?.message ?? msg.message ?? "Signaling error");
			}
		};

		socket.onclose = () => {
			if ($webCall.getState().status !== "error") setState("ended");
			cleanup();
			scheduleIdleReset();
		};
	} catch (err) {
		setState("error", err instanceof Error ? err.message : String(err));
		cleanup();
		scheduleIdleReset();
	}
}

export function hangupWebCall(): void {
	cleanup();
	setState("ended");
	scheduleIdleReset();
}

webCallRequested.watch((user) => { void startWebCall(user); });
webCallHangupRequested.watch(() => { hangupWebCall(); });
