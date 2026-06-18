import { useState, useRef, useCallback, useEffect } from "react";
import { audioGateClient, type GateTranscriptItem } from "../services/audio-gate-client";

export type CallStatus = "idle" | "connecting" | "connected" | "error" | "ended";

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

export function useWebRTCCall(phone?: string, contextName?: string, scope?: string): UseWebRTCCallReturn {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<GateTranscriptItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);
  const statusRef = useRef<CallStatus>("idle");

  const updateStatus = useCallback((s: CallStatus) => {
    statusRef.current = s;
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "hangup" }));
      } catch {
        // Ignore signaling teardown errors during local cleanup.
      }
    }
    wsRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    wsRef.current = null;
    streamRef.current = null;
  }, [stopVolumeMeter]);

  const startCall = useCallback(async () => {
    try {
      updateStatus("connecting");
      setError(null);
      setLiveTranscript([]);
      setSessionId(null);

      // ── Microphone ───────────────────────────────────────────────
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

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

      // ── WebSocket signaling ──────────────────────────────────────
      const wsUrl = audioGateClient.wsCallUrl(phone, contextName, scope);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout")), 10_000);
        ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection failed — make sure llm-audio-gate is running"));
        };
      });

      // Send SDP offer
      ws.send(JSON.stringify({
        type: "offer",
        sdp: pc.localDescription!.sdp,
        phone,
        contextName,
      }));

      ws.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (msg.type === "answer") {
          const sdp: string = msg.data?.sdp ?? msg.sdp;
          await pc.setRemoteDescription({ type: "answer", sdp });
          // Discover the session ID a couple seconds after answer
          setTimeout(async () => {
            const sessions = await audioGateClient.listSessions();
            if (sessions.length > 0) {
              setSessionId(sessions[sessions.length - 1]);
            }
          }, 2000);
        } else if (msg.type === "error") {
          setError(msg.data?.message ?? msg.message ?? "Signaling error");
          updateStatus("error");
        }
      };

      ws.onerror = () => {
        setError("WebSocket error");
        updateStatus("error");
      };

      ws.onclose = () => {
        if (statusRef.current !== "error") {
          updateStatus("ended");
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      updateStatus("error");
      cleanup();
    }
  }, [phone, contextName, scope, cleanup, updateStatus]);

  const hangup = useCallback(() => {
    cleanup();
    updateStatus("ended");
  }, [cleanup, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { status, error, volume, liveTranscript, sessionId, startCall, hangup };
}
