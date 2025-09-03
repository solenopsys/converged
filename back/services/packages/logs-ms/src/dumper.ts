// dumper.ts
import { ParquetSchema, ParquetWriter } from "parquets";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export type LogEntry = {
  timestamp: number;                 // epoch_ms
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
  }

  async dump(logs: LogEntry[]) {
    if (!logs?.length) return;

    // Группировка по дню YYYY-MM-DD
    const byDay = new Map<string, LogEntry[]>();
    for (const l of logs) {
      const date = new Date(l.timestamp).toISOString().slice(0, 10);
      (byDay.get(date) ?? (byDay.set(date, []), byDay.get(date)!)).push(l);
    }

    // Схема с компрессией на колонках
    const schema = new ParquetSchema({
      timestamp: { type: "TIMESTAMP_MILLIS", compression: "SNAPPY" },
      service:   { type: "UTF8",              compression: "SNAPPY" },
      level:     { type: "UTF8",              compression: "SNAPPY" },
      message:   { type: "UTF8",              compression: "SNAPPY" },
      // JSON как строка — максимально совместимо
      metadata:  { type: "UTF8", optional: true, compression: "SNAPPY" },
    });

    for (const [date, dayLogs] of byDay) {
      const file = `./data/parquet/logs_${date}.parquet`;
      const writer = await ParquetWriter.openFile(schema, file);
      writer.setRowGroupSize(8192); // разумный размер RG по количеству строк

      for (const l of dayLogs) {
        await writer.appendRow({
          timestamp: new Date(l.timestamp),       // TIMESTAMP_MILLIS ожидает Date
          service: l.service,
          level: l.level,
          message: l.message,
          metadata: l.metadata ? JSON.stringify(l.metadata) : null,
        });
      }

      await writer.close();
    }
  }

  // Тестовые данные
  async dumpTest() {
    const now = Date.now();
    const testLogs: LogEntry[] = [
      { timestamp: now - 3600000, service: "redis", level: "INFO",  message: "Redis server started", metadata: { port: 6379 } },
      { timestamp: now - 1800000, service: "redis", level: "ERROR", message: "Connection timeout",   metadata: { client: "app-1" } },
      { timestamp: now -  900000, service: "nginx", level: "INFO",  message: "Request processed",    metadata: { status: 200, path: "/api/test" } },
    ];

    await this.dump(testLogs);
    return testLogs;
  }
}
