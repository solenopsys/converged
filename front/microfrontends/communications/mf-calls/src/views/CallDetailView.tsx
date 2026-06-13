import React, { useEffect, useRef, useState } from "react";
import { Button, Badge } from "front-core";
import { ArrowLeft, RefreshCw, MessageSquare, MicOff } from "lucide-react";
import { StereoCallPlayer } from "../components/StereoCallPlayer";
import { fetchCallAudioObjectUrl } from "../services/call-audio";
import { audioGateClient, type GateTranscriptItem } from "../services/audio-gate-client";

type CallDetailViewProps = {
  sessionId: string;
  onBack?: () => void;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function sessionLabel(sessionId: string): string {
  // ULIDs: first 10 chars encode timestamp in Crockford base32
  // We display a short readable fragment
  return sessionId.slice(0, 8).toUpperCase() + "…" + sessionId.slice(-4).toUpperCase();
}

/** Build a one-sentence summary of the transcript for the metadata strip */
function buildSummary(items: GateTranscriptItem[]): string {
  if (items.length === 0) return "No transcript";
  const userLines = items.filter((t) => t.source === "user").map((t) => t.text);
  const aiLines   = items.filter((t) => t.source === "assistant").map((t) => t.text);
  const exchanges = Math.min(userLines.length, aiLines.length);
  const first = userLines[0] ? `"${userLines[0].slice(0, 60)}${userLines[0].length > 60 ? "…" : ""}"` : "";
  return [
    `${items.length} lines · ${exchanges} exchange${exchanges !== 1 ? "s" : ""}`,
    first,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ── main component ────────────────────────────────────────────────────────────

export const CallDetailView: React.FC<CallDetailViewProps> = ({ sessionId, onBack }) => {
  const [transcript, setTranscript] = useState<GateTranscriptItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userAudioUrl, setUserAudioUrl]           = useState<string | null>(null);
  const [assistantAudioUrl, setAssistantAudioUrl] = useState<string | null>(null);

  const hasUserAudio      = userAudioUrl !== null;
  const hasAssistantAudio = assistantAudioUrl !== null;

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
      const [items, userUrl, assistantUrl] = await Promise.all([
        audioGateClient.getTranscript(sessionId),
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

  const summary = buildSummary(transcript);

  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b bg-background flex items-center h-14 px-4 gap-3 shrink-0">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft size={14} />
            Back
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">
            Session{" "}
            <code className="font-mono text-sm text-muted-foreground">
              {sessionLabel(sessionId)}
            </code>
          </h1>
          {!loading && (
            <p className="text-xs text-muted-foreground truncate">{summary}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} className="gap-1.5 shrink-0">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_380px]">

          {/* ── Left: waveforms ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 p-4 border-r border-border min-h-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Recordings
            </p>

            {loading ? (
              <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                Loading…
              </div>
            ) : !hasUserAudio && !hasAssistantAudio ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <MicOff size={32} className="opacity-30" />
                <p className="text-sm">No recordings available for this session.</p>
              </div>
            ) : (
              <StereoCallPlayer userSrc={userAudioUrl} aiSrc={assistantAudioUrl} />
            )}

            {/* ── Metadata strip ─────────────────────────────────────────── */}
            {!loading && transcript.length > 0 && (
              <div className="mt-auto pt-4 border-t border-border grid grid-cols-3 gap-3">
                <MetaStat
                  label="Lines"
                  value={String(transcript.length)}
                />
                <MetaStat
                  label="You said"
                  value={String(transcript.filter((t) => t.source === "user").length)}
                />
                <MetaStat
                  label="AI said"
                  value={String(transcript.filter((t) => t.source === "assistant").length)}
                />
              </div>
            )}
          </div>

          {/* ── Right: transcript ──────────────────────────────────────────── */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <MessageSquare size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transcript
              </span>
              {transcript.length > 0 && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {transcript.length} lines
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No transcript available.</p>
              ) : (
                transcript.map((line, i) => (
                  <TranscriptLine key={i} line={line} />
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const MetaStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <div className="text-xl font-bold tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

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
