import React from "react";
import { JsonViewer } from "@textea/json-viewer";

export function JsonRenderer({ data }: { data: any }) {
  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="flex-1 min-h-0">
        <JsonViewer
          value={data}
          theme="dark"
          displayDataTypes={false}
          defaultInspectDepth={2}
          style={{ height: "100%", overflow: "auto", padding: "12px" }}
        />
      </div>
    </div>
  );
}
