import React, { useEffect, useRef, useState } from "react";
import { CallTranscriptPanel } from "front-core";
import { fetchCallAudioObjectUrl } from "../services/call-audio";
import { type GateTranscriptItem } from "../services/audio-gate-client";
import { readCallTranscript } from "../services/call-transcript";

type CallTranscriptViewProps = {
  sessionId: string;
};

/**
 * Compact transcript + recordings panel rendered in the right sidebar
 * when a call row is selected from the list. Data loading lives here;
 * rendering is the shared CallTranscriptPanel from front-core.
 */
export const CallTranscriptView: React.FC<CallTranscriptViewProps> = ({ sessionId }) => {
  const [transcript, setTranscript] = useState<GateTranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [assistantAudioUrl, setAssistantAudioUrl] = useState<string | null>(null);

  // Track live object URLs so we can revoke them on reload/unmount.
  const objectUrls = useRef<string[]>([]);
  const revokeUrls = () => {
    for (const u of objectUrls.current) URL.revokeObjectURL(u);
    objectUrls.current = [];
  };

  const loadData = async () => {
    setLoading(true);
    revokeUrls();
    setUserAudioUrl(null);
    setAssistantAudioUrl(null);
    try {
      // Transcript and recordings both come from the ms-calls microservice —
      // never from the gate. ms-calls serves the transcript (read from
      // ms-threads) and builds the WebM/Opus recording on demand.
      const [items, userUrl, assistantUrl] = await Promise.all([
        readCallTranscript(sessionId),
        fetchCallAudioObjectUrl(sessionId, "user"),
        fetchCallAudioObjectUrl(sessionId, "assistant"),
      ]);
      setTranscript(items);
      if (userUrl) objectUrls.current.push(userUrl);
      if (assistantUrl) objectUrls.current.push(assistantUrl);
      setUserAudioUrl(userUrl);
      setAssistantAudioUrl(assistantUrl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => revokeUrls();
  }, [sessionId]);

  return (
    <CallTranscriptPanel
      sessionId={sessionId}
      transcript={transcript}
      loading={loading}
      userAudioUrl={userAudioUrl}
      assistantAudioUrl={assistantAudioUrl}
      onRefresh={loadData}
    />
  );
};
