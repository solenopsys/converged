import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { COLUMN_TYPES } from "front-core";
import { Loader2, Mic, FileText } from "lucide-react";
import { $sessionMeta, sessionMetaRequested } from "./domain-calls";

export type CallRow = { id: string };

/** Subscribes a row to its lazily-loaded metadata, firing the load on mount. */
function useSessionMeta(id: string) {
  const meta = useUnit($sessionMeta);
  useEffect(() => {
    sessionMetaRequested(id);
  }, [id]);
  return meta[id];
}

const StatusCell: React.FC<{ id: string }> = ({ id }) => {
  const meta = useSessionMeta(id);
  if (!meta) return <Loader2 size={12} className="text-muted-foreground animate-spin" />;
  if (!meta.hasAudio && !meta.hasTranscript)
    return <span className="text-xs text-muted-foreground/50 italic">no data</span>;
  return (
    <div className="flex items-center gap-1.5">
      {meta.hasAudio && (
        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-blue-950/40 text-blue-300 border border-blue-800/50">
          <Mic size={10} />
          rec
        </span>
      )}
      {meta.hasTranscript && (
        <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-green-950/40 text-green-300 border border-green-800/50">
          <FileText size={10} />
          transcript
        </span>
      )}
    </div>
  );
};

const LinesCell: React.FC<{ id: string }> = ({ id }) => {
  const meta = useSessionMeta(id);
  if (!meta) return <span className="text-muted-foreground">—</span>;
  return <span className="text-sm font-mono tabular-nums">{meta.lines}</span>;
};

const CreatedCell: React.FC<{ id: string }> = ({ id }) => {
  const meta = useSessionMeta(id);
  const ms = meta?.createdAt;
  return (
    <span className="text-sm text-muted-foreground">
      {ms ? new Date(ms).toLocaleString("ru-RU") : "—"}
    </span>
  );
};

export const callsColumns = [
  { id: "id", title: "Session ID", type: COLUMN_TYPES.TEXT, width: 360, primary: true },
  {
    id: "status",
    title: "Status",
    type: COLUMN_TYPES.CUSTOM,
    width: 200,
    render: (_v: unknown, row: CallRow) => <StatusCell id={row.id} />,
  },
  {
    id: "lines",
    title: "Lines",
    type: COLUMN_TYPES.CUSTOM,
    width: 100,
    render: (_v: unknown, row: CallRow) => <LinesCell id={row.id} />,
  },
  {
    id: "createdAt",
    title: "Created",
    type: COLUMN_TYPES.CUSTOM,
    width: 200,
    render: (_v: unknown, row: CallRow) => <CreatedCell id={row.id} />,
  },
];
