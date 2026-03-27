import React from "react";
import { JsonViewer } from "@textea/json-viewer";

const JSON_VIEWER_THEME = {
  base00: "transparent",
  base01: "transparent",
  base02: "var(--ui-accent)",
  base03: "oklch(var(--muted-foreground) / 0.7)",
  base04: "oklch(var(--muted-foreground) / 0.9)",
  base05: "var(--ui-foreground)",
  base06: "oklch(var(--foreground) / 0.92)",
  base07: "oklch(var(--foreground) / 0.98)",
  base08: "oklch(0.73 0.16 22)",
  base09: "oklch(0.76 0.16 75)",
  base0A: "oklch(0.82 0.13 86)",
  base0B: "oklch(0.74 0.14 152)",
  base0C: "oklch(0.74 0.09 220)",
  base0D: "oklch(0.72 0.15 255)",
  base0E: "oklch(0.73 0.13 305)",
  base0F: "oklch(0.73 0.15 20)",
};

export function JsonRenderer({ data }: { data: any }) {
  return (
    <div className="w-full h-full">
      <JsonViewer
        value={data}
        theme={JSON_VIEWER_THEME}
        rootName="root"
        displayDataTypes={false}
        defaultInspectDepth={2}
        style={{
          height: "100%",
          overflow: "auto",
          padding: "12px",
          background: "transparent",
          color: "var(--ui-foreground)",
          fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
          fontSize: "13px",
          lineHeight: 1.45,
        }}
      />
    </div>
  );
}
