import { signalChannel } from "front-core/signal";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GateTranscriptItem } from "../services/call-transcript";

export type CallStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "error"
	| "ended";

export type UseWebRTCCallReturn = {
	status: CallStatus;
	error: string | null;
	/** Microphone volume 0–1 */
	volume: number;
	/** Live transcript lines that arrive after the call is connected */
	liveTranscript: GateTranscriptItem[];
	/** Session ID assigned after signaling succeeds */
	sessionId: string | null;
	startCall: () => Promise<void>;
	hangup: () => void;
};

export function useWebRTCCall(
	phone?: string,
	contextName?: string,
	_scope?: string,
): UseWebRTCCallReturn {
	const [status, setStatus] = useState<CallStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [volume, setVolume] = useState(0);
	const [liveTranscript, setLiveTranscript] = useState<GateTranscriptItem[]>(
		[],
	);
	const [sessionId, setSessionId] = useState<string | null>(null);

	const pcRef = useRef<RTCPeerConnection | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const animRef = useRef<number | null>(null);

	const updateStatus = useCallback((s: CallStatus) => {
		setStatus(s);
	}, []);

	const stopVolumeMeter = useCallback(() => {
		if (animRef.current !== null) {
			cancelAnimationFrame(animRef.current);
			animRef.current = null;
		}
		audioCtxRef.current?.close().catch(() => {});
		audioCtxRef.current = null;
		setVolume(0);
	}, []);

	const cleanup = useCallback(() => {
		stopVolumeMeter();
		pcRef.current?.close();
		streamRef.current?.getTracks().forEach((track) => {
			track.stop();
		});
		pcRef.current = null;
		streamRef.current = null;
	}, [stopVolumeMeter]);

	const endRemoteSession = useCallback(() => {
		const activeSessionId = sessionIdRef.current;
		if (!activeSessionId) return;
		signalChannel.send("resonus", "call.hangup", {
			sessionId: activeSessionId,
		});
		sessionIdRef.current = null;
	}, []);

	const startCall = useCallback(async () => {
		try {
			updateStatus("connecting");
			setError(null);
			setLiveTranscript([]);
			setSessionId(null);
			sessionIdRef.current = null;

			// ── Microphone ───────────────────────────────────────────────
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false,
			});
			streamRef.current = stream;

			// ── Volume meter ─────────────────────────────────────────────
			const audioCtx = new AudioContext();
			audioCtxRef.current = audioCtx;
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			audioCtx.createMediaStreamSource(stream).connect(analyser);
			const freqBuf = new Uint8Array(analyser.frequencyBinCount);

			const tick = () => {
				analyser.getByteFrequencyData(freqBuf);
				const avg = freqBuf.reduce((acc, v) => acc + v, 0) / freqBuf.length;
				setVolume(Math.min(1, (avg * 2) / 100));
				animRef.current = requestAnimationFrame(tick);
			};
			animRef.current = requestAnimationFrame(tick);

			// ── RTCPeerConnection ────────────────────────────────────────
			const pc = new RTCPeerConnection({
				iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
			});
			pcRef.current = pc;
			stream.getTracks().forEach((track) => {
				pc.addTrack(track, stream);
			});

			// Play incoming AI audio
			pc.ontrack = (e) => {
				const audioEl = new Audio();
				audioEl.srcObject = e.streams[0];
				audioEl.autoplay = true;
			};

			pc.oniceconnectionstatechange = () => {
				switch (pc.iceConnectionState) {
					case "connected":
					case "completed":
						updateStatus("connected");
						break;
					case "failed":
						updateStatus("error");
						setError("ICE connection failed");
						break;
				}
			};

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);

			await waitForIceGathering(pc);
			const sdp = pc.localDescription?.sdp;
			if (!sdp) throw new Error("Local SDP offer is empty");

			const response = await signalChannel.request(
				"resonus",
				"call.offer",
				{ sdp, phone, contextName },
				20_000,
			);
			if (response.name !== "call.answer") {
				throw new Error(
					`Unexpected signaling response: ${response.name ?? response.type}`,
				);
			}
			const payload = response.payload as { sdp?: unknown } | undefined;
			if (typeof payload?.sdp !== "string" || !payload.sdp) {
				throw new Error("Resonus answer did not contain SDP");
			}
			if (typeof response.sessionId !== "string" || !response.sessionId) {
				throw new Error("Resonus answer did not contain sessionId");
			}
			sessionIdRef.current = response.sessionId;
			setSessionId(response.sessionId);
			await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg);
			updateStatus("error");
			endRemoteSession();
			cleanup();
		}
	}, [phone, contextName, cleanup, endRemoteSession, updateStatus]);

	const hangup = useCallback(() => {
		endRemoteSession();
		cleanup();
		updateStatus("ended");
	}, [cleanup, endRemoteSession, updateStatus]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			endRemoteSession();
			cleanup();
		};
	}, [cleanup, endRemoteSession]);

	return {
		status,
		error,
		volume,
		liveTranscript,
		sessionId,
		startCall,
		hangup,
	};
}

async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
	if (pc.iceGatheringState === "complete") return;
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(done, 3_000);
		function done() {
			clearTimeout(timeout);
			pc.removeEventListener("icegatheringstatechange", onChange);
			resolve();
		}
		function onChange() {
			if (pc.iceGatheringState === "complete") done();
		}
		pc.addEventListener("icegatheringstatechange", onChange);
	});
}
