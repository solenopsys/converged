import React, { useEffect, useState } from "react";
import { useUnit } from "effector-react";
import { Button, Badge, HeaderPanel } from "front-core";
import { PhoneCall, RefreshCw, ChevronRight, Inbox, Mic, FileText, Loader2 } from "lucide-react";
import {
  $sessions,
  $sessionsLoading,
  $showActiveCall,
  $selectedSessionId,
  sessionsListMounted,
  refreshSessionsClicked,
  openCallDetail,
  startNewCallClicked,
  returnToListClicked,
} from "../domain-calls";
import { audioGateClient } from "../services/audio-gate-client";
import { ActiveCallView } from "./ActiveCallView";
import { CallDetailView } from "./CallDetailView";

type CallsListViewProps = {
  bus?: any;
};

export const CallsListView: React.FC<CallsListViewProps> = () => {
  const sessions = useUnit($sessions);
  const loading = useUnit($sessionsLoading);
  const showActiveCall = useUnit($showActiveCall);
  const selectedSessionId = useUnit($selectedSessionId);

  useEffect(() => {
    sessionsListMounted();
  }, []);

  // ── Sub-view routing ─────────────────────────────────────────────────────
  if (showActiveCall) {
    return (
      <ActiveCallView
        onBack={() => returnToListClicked()}
      />
    );
  }

  if (selectedSessionId) {
    return (
      <CallDetailView
        sessionId={selectedSessionId}
        onBack={() => returnToListClicked()}
      />
    );
  }

  // ── Main list ────────────────────────────────────────────────────────────
  const headerConfig = {
    title: "Calls",
    actions: [
      {
        id: "new-call",
        label: "New Call",
        icon: PhoneCall,
        event: startNewCallClicked,
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshSessionsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
            <Inbox size={40} className="opacity-30" />
            <p className="text-sm">No call sessions yet.</p>
            <Button
              onClick={() => startNewCallClicked()}
              className="gap-2"
            >
              <PhoneCall size={16} />
              Start your first call
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((sessionId) => (
              <SessionRow
                key={sessionId}
                sessionId={sessionId}
                onClick={() => openCallDetail({ sessionId })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Session row component ────────────────────────────────────────────────────
type SessionRowProps = {
  sessionId: string;
  onClick: () => void;
};

type AvailabilityState = "checking" | "none" | "audio" | "transcript" | "both";

const SessionRow: React.FC<SessionRowProps> = ({ sessionId, onClick }) => {
  const [avail, setAvail] = useState<AvailabilityState>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const userUrl  = audioGateClient.recordingUrl(sessionId, "user");
      const transcriptItems = await audioGateClient.getTranscript(sessionId).catch(() => []);
      const [userResp] = await Promise.all([
        fetch(userUrl, { method: "HEAD" }).catch(() => null),
      ]);
      if (cancelled) return;
      const hasAudio = userResp?.ok === true;
      const hasTx    = transcriptItems.length > 0;
      if (hasAudio && hasTx) setAvail("both");
      else if (hasAudio)     setAvail("audio");
      else if (hasTx)        setAvail("transcript");
      else                   setAvail("none");
    };
    check();
    return () => { cancelled = true; };
  }, [sessionId]);

  const displayId = sessionId.length > 26 ? sessionId.slice(0, 26) : sessionId;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors p-3 flex items-center gap-3 group"
    >
      {/* Left: session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            Session
          </Badge>
          <code className="text-xs text-muted-foreground font-mono truncate">
            {displayId}
          </code>
        </div>

        {/* Availability badges */}
        <div className="flex items-center gap-1.5">
          {avail === "checking" ? (
            <Loader2 size={11} className="text-muted-foreground animate-spin" />
          ) : avail === "none" ? (
            <span className="text-xs text-muted-foreground/50 italic">no data yet</span>
          ) : (
            <>
              {(avail === "audio" || avail === "both") && (
                <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-blue-950/40 text-blue-300 border border-blue-800/50">
                  <Mic size={10} />
                  recording
                </span>
              )}
              {(avail === "transcript" || avail === "both") && (
                <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-green-950/40 text-green-300 border border-green-800/50">
                  <FileText size={10} />
                  transcript
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </button>
  );
};
