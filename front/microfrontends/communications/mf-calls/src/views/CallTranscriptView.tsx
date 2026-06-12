import React, { useEffect, useState } from "react";
import { Badge } from "front-core";
import { MessageSquare, MicOff, RefreshCw, Bot } from "lucide-react";
import { threadsClient } from "g-threads";
import { WaveformPlayer } from "../components/WaveformPlayer";
import { audioGateClient, type GateTranscriptItem } from "../services/audio-gate-client";

type CallTranscriptViewProps = {
  sessionId: string;
};

function sessionLabel(sessionId: string): string {
  return sessionId.slice(0, 8).toUpperCase() + "…" + sessionId.slice(-4).toUpperCase();
}

/**
 * Compact transcript + recordings panel rendered in the right sidebar
 * when a call row is selected from the list.
 */
export const CallTranscriptView: React.FC<CallTranscriptViewProps> = ({ sessionId }) => {
  const [transcript, setTranscript] = useState<GateTranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUserAudio, setHasUserAudio] = useState(false);
  const [hasAssistantAudio, setHasAssistantAudio] = useState(false);

  const userAudioUrl = audioGateClient.recordingUrl(sessionId, "user");
  const assistantAudioUrl = audioGateClient.recordingUrl(sessionId, "assistant");

  const loadData = async () => {
    setLoading(true);
    try {
      // Transcript is read straight from ms-threads (the call id is its
      // threadId, and the gate stores each phrase as a thread message), not
      // from the audio-gate REST API.
      const [rows, userResp, assistantResp] = await Promise.all([
        threadsClient.readThread(sessionId).catch(() => []),
        fetch(userAudioUrl, { method: "HEAD" }).catch(() => null),
        fetch(assistantAudioUrl, { method: "HEAD" }).catch(() => null),
      ]);
      const items: GateTranscriptItem[] = rows
        .map((m: any) => ({
          source: m.user === "assistant" ? "assistant" : "user",
          text: m.data ?? "",
          time: Number(m.timestamp ?? 0),
        }))
        .filter((it) => it.text.length > 0)
        .sort((a, b) => a.time - b.time);
      setTranscript(items);
      setHasUserAudio(userResp?.ok === true);
      setHasAssistantAudio(assistantResp?.ok === true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const hasAudio = hasUserAudio || hasAssistantAudio;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
        <Bot size={16} className="text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Transcript</p>
          <code className="text-[11px] text-muted-foreground font-mono">
            {sessionLabel(sessionId)}
          </code>
        </div>
        <button
          onClick={loadData}
          title="Refresh"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Recordings */}
      {hasAudio && (
        <div className="flex flex-col gap-4 p-4 border-b border-border shrink-0">
          {hasUserAudio && <WaveformPlayer src={userAudioUrl} label="You" color="#3b82f6" />}
          {hasAssistantAudio && (
            <WaveformPlayer src={assistantAudioUrl} label="AI" color="#22c55e" />
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <MessageSquare size={13} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Conversation
        </span>
        {transcript.length > 0 && (
          <Badge variant="outline" className="text-xs ml-auto">
            {transcript.length} lines
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground px-1">Loading…</p>
        ) : transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
            <MicOff size={28} className="opacity-30" />
            <p className="text-sm">No transcript for this session.</p>
          </div>
        ) : (
          transcript.map((line, i) => <TranscriptLine key={i} line={line} />)
        )}
      </div>
    </div>
  );
};

const TranscriptLine: React.FC<{ line: GateTranscriptItem }> = ({ line }) => {
  const isUser = line.source === "user";
  return (
    <div className={`flex gap-2 text-sm ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 ${
          isUser
            ? "bg-blue-900/40 text-blue-100 rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        <div className="text-[10px] opacity-50 mb-0.5 font-mono">
          {isUser ? "You" : "AI"} · {new Date(line.time * 1000).toLocaleTimeString()}
        </div>
        {line.text}
      </div>
    </div>
  );
};
