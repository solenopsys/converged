import React from "react";
import { JsonViewer } from "@textea/json-viewer";

const sampleData = {
  id: 1,
  name: "Converged",
  modules: [
    { id: "agent", price: 30, active: true },
    { id: "logs", price: 6, active: false },
  ],
  meta: {
    version: "1.0.0",
    deployed: true,
  },
};

export default function JsonExample() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Пример JSON Viewer</h2>
      <JsonViewer
        value={sampleData}
        theme="dark"        // или "light", можно также передавать объект со своими цветами
        displayDataTypes={false} // скрыть типы (string, number и т.д.)
        defaultInspectDepth={2}  // глубина раскрытия по умолчанию
      />
    </div>
  );
}
