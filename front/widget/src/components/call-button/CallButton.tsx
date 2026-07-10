import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import styles from './CallButton.module.css';

type Phase = 'idle' | 'starting' | 'inCall';
type StatusVariant = 'idle' | 'connecting' | 'connected' | 'error';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const OFFER_OPTIONS: RTCOfferOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 0
};

const WS_PATH = '/audio-gate/ws';
const USER_ID = '924334534534';

const buildWsUrl = () => {
  const ensureWsProtocol = (protocol: string) => {
    if (protocol === 'http:') {
      return 'ws:';
    }
    if (protocol === 'https:') {
      return 'wss:';
    }
    return protocol;
  };

  const applyUserParam = (url: URL) => {
    url.searchParams.set('user', USER_ID);
    return url.toString();
  };

  const getBaseOrigin = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://localhost';
  };

  const getDefaultProtocol = () => {
    if (typeof window !== 'undefined') {
      return window.location.protocol;
    }
    return 'https:';
  };

  const ensureAbsolute = (raw: string) => {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) {
      return raw;
    }
    if (raw.startsWith('//')) {
      return `${getDefaultProtocol()}${raw}`;
    }
    if (raw.startsWith('/')) {
      return raw;
    }
    return `//${raw}`;
  };

  const baseOrigin = getBaseOrigin();
  const normalized = ensureAbsolute(WS_PATH);

  try {
    const url = new URL(normalized, baseOrigin);
    url.protocol = ensureWsProtocol(url.protocol);
    return applyUserParam(url);
  } catch {
    const protocol = ensureWsProtocol(getDefaultProtocol());
    const host = typeof window !== 'undefined' ? window.location.host ?? '' : 'localhost';
    const leadingSlash = normalized.startsWith('/') ? '' : '/';
    const separator = normalized.includes('?') ? '&' : '?';
    return `${protocol}//${host}${leadingSlash}${normalized}${separator}user=${USER_ID}`;
  }
};

const CallButton = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Ready to start call');
  const [statusVariant, setStatusVariant] = useState<StatusVariant>('idle');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupInProgressRef = useRef(false);
  const manualWsCloseRef = useRef(false);
  const isMountedRef = useRef(true);

  const debugLog = useCallback((message: string) => {
    if (!isMountedRef.current) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  }, []);

  const updateStatus = useCallback((message: string, variant: StatusVariant = 'idle') => {
    if (!isMountedRef.current) {
      return;
    }
    setStatus(message);
    setStatusVariant(variant);
    debugLog(`STATUS: ${message}`);
  }, [debugLog]);

  const sendSignalingMessage = useCallback((type: string, data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      debugLog(`Sending signaling message: ${type}`);
      ws.send(JSON.stringify({ type, data }));
    } else {
      debugLog('WebSocket not ready for sending message');
    }
  }, [debugLog]);

  const cleanup = useCallback(
    async (options?: { silent?: boolean }) => {
      if (cleanupInProgressRef.current) {
        return;
      }

      cleanupInProgressRef.current = true;

      try {
        debugLog('Starting cleanup...');

        const pc = pcRef.current;
        if (pc) {
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.onconnectionstatechange = null;
          pc.oniceconnectionstatechange = null;
          pc.close();
          pcRef.current = null;
          debugLog('Peer connection closed');
        }

        const stream = localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            debugLog(`Stopped track: ${track.kind}`);
          });
          localStreamRef.current = null;
        }

        const ws = wsRef.current;
        if (ws) {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            manualWsCloseRef.current = true;
            ws.close();
          }
          wsRef.current = null;
          debugLog('WebSocket closed');
        }

        const localAudio = localAudioRef.current;
        if (localAudio) {
          localAudio.srcObject = null;
        }

        const remoteAudio = remoteAudioRef.current;
        if (remoteAudio) {
          remoteAudio.srcObject = null;
        }

        if (!options?.silent && isMountedRef.current) {
          setPhase('idle');
        }
      } finally {
        cleanupInProgressRef.current = false;
        debugLog('Cleanup completed');
      }
    },
    [debugLog]
  );

  const handleSignalingMessage = useCallback(async (message: { type: string; data?: unknown }) => {
    debugLog(`Handling signaling message: ${message.type}`);

    try {
      switch (message.type) {
        case 'answer': {
          const pc = pcRef.current;
          if (pc && message.data) {
            debugLog('Setting remote description from answer');
            await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));
            updateStatus('Call connected - speak now!', 'connected');
          }
          break;
        }
        case 'ice-candidate': {
          const pc = pcRef.current;
          if (pc && message.data) {
            debugLog('Adding ICE candidate');
            await pc.addIceCandidate(new RTCIceCandidate(message.data as RTCIceCandidateInit));
          }
          break;
        }
        default:
          debugLog(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      debugLog(`Error handling signaling message: ${messageText}`);
      updateStatus('Error in call setup', 'error');
    }
  }, [debugLog, updateStatus]);

  const connectWebSocket = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        const wsUrl = buildWsUrl();
        debugLog(`Connecting WebSocket to: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        manualWsCloseRef.current = false;

        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            debugLog('WebSocket connection timeout');
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

        ws.onopen = () => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeoutId);
          updateStatus('WebSocket connected', 'connected');
          resolve();
        };

        ws.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data as string);
            debugLog(`WS Message: ${payload.type}`);
            await handleSignalingMessage(payload);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            debugLog(`Error handling WebSocket message: ${messageText}`);
          }
        };

        ws.onclose = (event) => {
          window.clearTimeout(timeoutId);
          if (!settled) {
            settled = true;
            reject(new Error(`WebSocket closed before opening: ${event.code}`));
          }

          if (manualWsCloseRef.current) {
            manualWsCloseRef.current = false;
            debugLog(`WebSocket closed: ${event.code} ${event.reason}`);
            return;
          }

          updateStatus('WebSocket disconnected', 'error');
          debugLog(`WebSocket closed: ${event.code} ${event.reason}`);
        };

        ws.onerror = (event) => {
          window.clearTimeout(timeoutId);
          if (!settled) {
            settled = true;
            reject(new Error('WebSocket connection failed'));
          }
          const errorMessage = (event as ErrorEvent)?.message ?? (event as Event).type;
          updateStatus('WebSocket connection failed', 'error');
          debugLog(`WebSocket error: ${errorMessage}`);
        };
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        reject(new Error(messageText));
      }
    });
  }, [debugLog, handleSignalingMessage, updateStatus]);

  const startCall = useCallback(async () => {
    if (phase !== 'idle') {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      updateStatus('getUserMedia is not supported in this environment', 'error');
      return;
    }

    setPhase('starting');

    try {
      updateStatus('Connecting...', 'connecting');

      await connectWebSocket();

      updateStatus('Getting microphone access...', 'connecting');

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = localStream;
      debugLog(`Got media stream with ${localStream.getAudioTracks().length} audio tracks`);
      localStream.getAudioTracks().forEach(track => {
        const settings = track.getSettings();
        debugLog(`Audio track settings: ${JSON.stringify(settings)}`);
      });

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }

      updateStatus('Creating peer connection...', 'connecting');

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      localStream.getTracks().forEach(track => {
        debugLog(`Adding track: ${track.kind} ${track.label}`);
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        debugLog(`Received remote track: ${event.track.kind}`);
        const [remoteStream] = event.streams;

        if (remoteStream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          updateStatus('Receiving AI audio...', 'connected');
          event.track.onmute = () => debugLog('Remote track muted');
          event.track.onunmute = () => debugLog('Remote track unmuted');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          debugLog(`Sending ICE candidate: ${event.candidate.candidate}`);
          sendSignalingMessage('ice-candidate', event.candidate);
        } else {
          debugLog('ICE gathering completed');
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        debugLog(`Connection state: ${state}`);

        switch (state) {
          case 'connected':
            updateStatus('Call connected - speak now!', 'connected');
            break;
          case 'disconnected':
          case 'failed':
            updateStatus('Call failed or disconnected', 'error');
            cleanup();
            break;
          case 'closed':
            updateStatus('Call ended', 'idle');
            cleanup();
            break;
          default:
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        debugLog(`ICE connection state: ${pc.iceConnectionState}`);
      };

      updateStatus('Creating call offer...', 'connecting');
      const offer = await pc.createOffer(OFFER_OPTIONS);

      if (offer.sdp) {
        debugLog(`Original SDP length: ${offer.sdp.length}`);
        debugLog(offer.sdp.includes('opus') ? 'Opus codec found in SDP - will use default format' : 'Opus codec not found in SDP');
      }

      await pc.setLocalDescription(offer);
      sendSignalingMessage('offer', offer);

      if (isMountedRef.current) {
        setPhase('inCall');
      }

      updateStatus('Waiting for AI response...', 'connecting');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      debugLog(`Error starting call: ${messageText}`);
      updateStatus(`Error: ${messageText}`, 'error');
      await cleanup();
    }
  }, [cleanup, connectWebSocket, debugLog, phase, sendSignalingMessage, updateStatus]);

  const hangupCall = useCallback(async () => {
    if (phase === 'idle') {
      return;
    }

    updateStatus('Ending call...', 'connecting');
    await cleanup();

    if (isMountedRef.current) {
      updateStatus('Call ended', 'idle');
    }
  }, [cleanup, phase, updateStatus]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup({ silent: true });
    };
  }, [cleanup]);

  const isStarting = phase === 'starting';
  const isInCall = phase === 'inCall';

  const buttonLabel = isInCall ? 'End Call' : isStarting ? 'Connecting...' : 'Start Call';
  const buttonClassName = [
    styles.button,
    isInCall ? styles.hangupButton : styles.callButton
  ].join(' ');
  const buttonHandler = isInCall ? hangupCall : startCall;
  const buttonDisabled = isStarting;

  const statusClassName = [
    styles.status,
    statusVariant === 'connecting' ? styles.statusConnecting : '',
    statusVariant === 'connected' ? styles.statusConnected : '',
    statusVariant === 'error' ? styles.statusError : ''
  ].filter(Boolean).join(' ');

  const debugText = debugLogs.join('\n');

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={buttonClassName}
        onClick={buttonHandler}
        disabled={buttonDisabled}
      >
        {buttonLabel}
      </button>

      <div className={statusClassName}>{status}</div>

      <div className={styles.debug}>{debugText || 'Debug log will appear here...'}</div>

      <audio ref={localAudioRef} className={styles.audio} autoPlay muted />
      <audio ref={remoteAudioRef} className={styles.audio} autoPlay />
    </div>
  );
};

export default CallButton;
