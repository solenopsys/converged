import {
    Table,
    WriterPropertiesBuilder,
    Compression,
    writeParquet,
  } from "parquet-wasm/node";
  
  import { writeFile, mkdir } from "node:fs/promises";
  import { existsSync } from "node:fs";
  
  type LogEntry = {
    timestamp: number;
    service: string;
    level: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
  
  export class Dumper {
    async init() {
      if (!existsSync("./data/parquet")) {
        await mkdir("./data/parquet", { recursive: true });
      }
      // No need for initWasm() with the Node.js version
    }
  
    async dump(logs: LogEntry[]) {
      if (!logs.length) return;
  
      const byDay = new Map<string, LogEntry[]>();
      for (const log of logs) {
        const date = new Date(log.timestamp).toISOString().split("T")[0];
        if (!byDay.has(date)) byDay.set(date, []);
        byDay.get(date)!.push(log);
      }
  
      for (const [date, dayLogs] of byDay) {
        const table = Table.from(dayLogs.map((l) => ({
          timestamp: l.timestamp,
          service: l.service,
          level: l.level,
          message: l.message,
          metadata: JSON.stringify(l.metadata ?? {}),
        })));
  
        const props = new WriterPropertiesBuilder()
          .setCompression(Compression.ZSTD)
          .build();
  
        const bytes = writeParquet(table, props);
        await writeFile(`./data/parquet/logs_${date}.parquet`, bytes);
      }
    }
  }