import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
} from "front-core";
import { PhoneCall, PhoneOff, ArrowLeft, Mic, MicOff } from "lucide-react";
import { useWebRTCCall, type CallStatus } from "../hooks/useWebRTCCall";
import { audioGateClient, type GateTranscriptItem } from "../services/audio-gate-client";

type ActiveCallViewProps = {
  onBack?: () => void;
};

function statusLabel(s: CallStatus): { text: string; color: string } {
  switch (s) {
    case "idle":
      return { text: "Ready", color: "text-muted-foreground" };
    case "connecting":
      return { text: "Connecting…", color: "text-amber-400" };
    case "connected":
      return { text: "Connected", color: "text-green-400" };
    case "error":
      return { text: "Error", color: "text-red-400" };
    case "ended":
      return { text: "Ended", color: "text-muted-foreground" };
  }
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({ onBack }) => {
  const [phone, setPhone] = useState("+79001234567");
  // Context KEY (alias) to call with. Contexts themselves are authored in
  // mf-contexts (ms-contexts) — this view only picks which one to dial.
  const [contextName, setContextName] = useState("club");
  const [transcript, setTranscript] = useState<GateTranscriptItem[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const contextKey = contextName.trim() || phone;

  const { status, error, volume, sessionId, startCall, hangup } = useWebRTCCall(phone, contextKey);

  const isActive = status === "connecting" || status === "connected";
  const { text: statusText, color: statusColor } = statusLabel(status);

  // Poll transcript while connected
  useEffect(() => {
    if (status !== "connected" || !sessionId) return;

    const refresh = async () => {
      const items = await audioGateClient.getTranscript(sessionId);
      setTranscript(items);
    };

    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [status, sessionId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Simple header row — avoids Effector event requirement of HeaderPanel */}
      <div className="border-b bg-background flex items-center h-14 px-4 gap-3 shrink-0">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft size={14} />
            Back
          </Button>
        )}
        <h1 className="text-lg font-semibold">New Call</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* ── Left: call controls + transcript ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-3">
                  <span>Call</span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono ${statusColor}`}
                  >
                    {statusText}
                  </Badge>
                  {status === "connecting" && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {status === "connected" && (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Phone input */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground w-20 shrink-0">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isActive}
                    placeholder="+79001234567"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground w-20 shrink-0">Context</label>
                  <input
                    type="text"
                    value={contextName}
                    onChange={(e) => setContextName(e.target.value)}
                    disabled={isActive}
                    placeholder="club"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Volume meter */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground w-20 shrink-0 flex items-center gap-1">
                    {volume > 0.01 ? <Mic size={14} /> : <MicOff size={14} />}
                    Mic
                  </label>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-100 rounded-full"
                      style={{ width: `${Math.round(volume * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                {/* Call buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={startCall}
                    disabled={isActive}
                    className="gap-2"
                  >
                    <PhoneCall size={16} />
                    Start Call
                  </Button>
                  <Button
                    onClick={hangup}
                    disabled={!isActive}
                    variant="destructive"
                    className="gap-2"
                  >
                    <PhoneOff size={16} />
                    Hang Up
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Live transcript */}
            {(status === "connected" || transcript.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                    Live Transcript
                    {sessionId && (
                      <span className="ml-2 font-mono text-xs normal-case opacity-50">
                        {sessionId.slice(0, 12)}…
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={transcriptRef}
                    className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1"
                  >
                    {transcript.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Waiting for transcript…
                      </p>
                    ) : (
                      transcript.map((line, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 text-sm ${
                            line.source === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              line.source === "user"
                                ? "bg-blue-900/40 text-blue-200"
                                : "bg-green-900/30 text-green-200"
                            }`}
                          >
                            <div className="text-xs opacity-60 mb-0.5">
                              {line.source === "user" ? "You" : "AI"}
                            </div>
                            {line.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right: info ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                  How it works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>1. Enter phone number and press <strong>Start Call</strong>.</p>
                <p>2. Allow microphone access in the browser.</p>
                <p>3. Speak — the AI responds in real-time via WebRTC.</p>
                <p>4. The session is saved after you hang up.</p>
                <Separator className="my-2" />
                <p className="opacity-60">
                  Powered by OpenAI Realtime API via{" "}
                  <code className="text-xs bg-muted px-1 rounded">llm-audio-gate</code>.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
