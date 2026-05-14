import React from "react";
import { JsonRenderer } from "front-core";

type ToolCallJsonViewProps = {
  title: string;
  toolCallId?: string;
  summary?: string;
  details?: Record<string, any> | Array<unknown> | string;
};

export const ToolCallJsonView: React.FC<ToolCallJsonViewProps> = ({
  title,
  toolCallId,
  summary,
  details,
}) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {toolCallId ?? "tool-call"}
          </div>
          {summary ? (
            <div className="mt-2 text-sm text-muted-foreground">{summary}</div>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <JsonRenderer data={details ?? {}} />
      </div>
    </div>
  );
};
