// example.ts
import { NativeWriter } from "./native";

const schema = [
  { name: "timestamp_ms", type: "UInt64" },
  { name: "service", type: "String" },
  { name: "level", type: "String" },
  { name: "message", type: "String" },
  { name: "metadata_json", type: "String" },
] as const;

const rows = [
  {
    timestamp_ms: BigInt(Date.now()),
    service: "logs-ms",
    level: "info",
    message: "hello",
    metadata_json: JSON.stringify({ a: 1 }),
  },
  {
    timestamp_ms: BigInt(Date.now() + 1),
    service: "logs-ms",
    level: "warn",
    message: "something happened",
    metadata_json: "",
  },
];

const writer = new NativeWriter("./data/logs.native", schema as any);
await writer.open();
await writer.append(rows);
await writer.close();

console.log("Wrote", rows.length, "rows into ./data/logs.native");
