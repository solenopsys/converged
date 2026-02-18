import { describe, it, expect } from "bun:test";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { StanchionDatabase } from "../src/index";

const RUN_STRESS = process.env.BUN_STANCHION_STRESS === "1";
const stress = RUN_STRESS ? it : it.skip;

const LOG_ROWS = Number(process.env.BUN_STANCHION_LOG_ROWS ?? "1000000");
const TELEMETRY_ROWS = Number(
  process.env.BUN_STANCHION_TELEMETRY_ROWS ?? "1000000",
);

const ERROR_TYPE_COUNT = 32; // 0..31 (byte codes)
const LEVEL_COUNT = 6; // 0..5 (byte codes)

const PRINTER_COUNT = 200;
const TELEMETRY_STATES = 5; // 0 idle, 1 preheat, 2 printing, 3 cooling, 4 error

const LOG_TABLE_DDL = `
CREATE VIRTUAL TABLE log_events
USING stanchion (
  ts INTEGER NOT NULL,
  host TEXT NOT NULL,
  service TEXT NOT NULL,
  error_type INTEGER NOT NULL,
  level INTEGER NOT NULL,
  code INTEGER NOT NULL,
  message TEXT NOT NULL,
  latency_ms FLOAT NOT NULL,
  SORT KEY (ts, service)
);
`;

const TELEMETRY_TABLE_DDL = `
CREATE VIRTUAL TABLE printer_telemetry
USING stanchion (
  ts INTEGER NOT NULL,
  printer_id TEXT NOT NULL,
  job_id INTEGER NOT NULL,
  state INTEGER NOT NULL,
  nozzle_temp FLOAT NOT NULL,
  bed_temp FLOAT NOT NULL,
  chamber_temp FLOAT NOT NULL,
  flow_rate FLOAT NOT NULL,
  print_speed FLOAT NOT NULL,
  fan_speed INTEGER NOT NULL,
  layer INTEGER NOT NULL,
  progress FLOAT NOT NULL,
  vibration FLOAT NOT NULL,
  power_watts FLOAT NOT NULL,
  error_code INTEGER NOT NULL,
  SORT KEY (printer_id, ts)
);
`;

function makeRng(seed: number) {
  let s = seed | 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
}

function removeDbFiles(dbPath: string) {
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

describe("bun-stanchion stress", () => {
  stress(
    "logs + telemetry (1M rows each by default)",
    () => {
      const dbPath = join(tmpdir(), `stanchion_stress_${process.pid}.db`);
      removeDbFiles(dbPath);

      const db = new StanchionDatabase(dbPath);
      try {
        db.exec("PRAGMA journal_mode = WAL;");
        db.exec("PRAGMA synchronous = NORMAL;");
        db.exec("PRAGMA temp_store = MEMORY;");

        db.exec(LOG_TABLE_DDL);
        db.exec(TELEMETRY_TABLE_DDL);

        const hosts = [
          "api-1",
          "api-2",
          "worker-1",
          "worker-2",
          "edge-1",
          "edge-2",
        ];
        const services = [
          "auth",
          "payments",
          "ingest",
          "scheduler",
          "storage",
          "metrics",
          "alerts",
          "api",
        ];

        const logCounts = new Uint32Array(ERROR_TYPE_COUNT * LEVEL_COUNT);

        const insertLog = db.prepare(
          "INSERT INTO log_events (ts, host, service, error_type, level, code, message, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        );

        const logInsertStart = performance.now();
        db.exec("BEGIN");
        const logBaseTs = 1_720_000_000_000;
        const rng = makeRng(0xc0ffee);
        const combos = ERROR_TYPE_COUNT * LEVEL_COUNT;

        for (let i = 0; i < LOG_ROWS; i++) {
          const combo = i % combos;
          const errorType = combo % ERROR_TYPE_COUNT;
          const level = (combo / ERROR_TYPE_COUNT) | 0;
          const host = hosts[i % hosts.length];
          const service = services[((i / hosts.length) % services.length) | 0];
          const ts = logBaseTs + i;
          const code = (errorType << 8) | level;
          const latencyMs = 5 + (rng() % 250) / 10;
          const message = `E${errorType}-L${level}`;

          logCounts[errorType * LEVEL_COUNT + level] += 1;
          insertLog.run(
            ts,
            host,
            service,
            errorType,
            level,
            code,
            message,
            latencyMs,
          );
        }
        db.exec("COMMIT");
        const logInsertMs = performance.now() - logInsertStart;

        const logQueryStart = performance.now();
        const logSummary = db
          .query(
            "SELECT error_type, level, COUNT(*) AS count FROM log_events GROUP BY error_type, level",
          )
          .all() as Array<{ error_type: number; level: number; count: number }>;
        const logQueryMs = performance.now() - logQueryStart;

        let logTotal = 0;
        for (const row of logSummary) {
          const expected = logCounts[row.error_type * LEVEL_COUNT + row.level];
          expect(row.count).toBe(expected);
          logTotal += row.count;
        }
        expect(logTotal).toBe(LOG_ROWS);
        console.log(
          `log insert: ${formatMs(logInsertMs)} | log group-by: ${formatMs(logQueryMs)}`,
        );

        const printerIds = Array.from(
          { length: PRINTER_COUNT },
          (_, idx) => `PRN-${idx.toString().padStart(4, "0")}`,
        );
        const stateCounts = new Uint32Array(TELEMETRY_STATES);

        const insertTelemetry = db.prepare(
          "INSERT INTO printer_telemetry (ts, printer_id, job_id, state, nozzle_temp, bed_temp, chamber_temp, flow_rate, print_speed, fan_speed, layer, progress, vibration, power_watts, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        );

        const telemetryInsertStart = performance.now();
        db.exec("BEGIN");
        const telemetryBaseTs = 1_720_000_100_000;
        for (let i = 0; i < TELEMETRY_ROWS; i++) {
          const printerIndex = i % PRINTER_COUNT;
          const printerId = printerIds[printerIndex];
          const ts = telemetryBaseTs + i;
          const jobId = 10_000 + ((i / 2000) | 0);
          const state = ((i / PRINTER_COUNT) % TELEMETRY_STATES) | 0;

          const nozzleTemp =
            190 + (printerIndex % 5) * 5 + (state === 2 ? 15 : 0) + (i % 7);
          const bedTemp = 60 + (printerIndex % 3) * 5 + (state === 2 ? 10 : 0);
          const chamberTemp = 30 + (state === 2 ? 8 : 0) + (i % 3);
          const flowRate = 1.2 + (i % 10) / 10;
          const printSpeed =
            40 + (printerIndex % 4) * 10 + (state === 2 ? 10 : 0);
          const fanSpeed = 20 + (state === 2 ? 60 : 0) + (i % 15);
          const layer = i % 6000;
          const progress = (layer / 6000) * 100;
          const vibration = 0.05 + (i % 20) / 100;
          const powerWatts = 80 + (state === 2 ? 40 : 0) + (printerIndex % 10);
          const errorCode = state === 4 ? i % 32 : 0;

          stateCounts[state] += 1;
          insertTelemetry.run(
            ts,
            printerId,
            jobId,
            state,
            nozzleTemp,
            bedTemp,
            chamberTemp,
            flowRate,
            printSpeed,
            fanSpeed,
            layer,
            progress,
            vibration,
            powerWatts,
            errorCode,
          );
        }
        db.exec("COMMIT");
        const telemetryInsertMs = performance.now() - telemetryInsertStart;

        const telemetryQueryStart = performance.now();
        const telemetrySummary = db
          .query(
            "SELECT state, COUNT(*) AS count FROM printer_telemetry GROUP BY state",
          )
          .all() as Array<{ state: number; count: number }>;
        const telemetryQueryMs = performance.now() - telemetryQueryStart;

        let telemetryTotal = 0;
        for (const row of telemetrySummary) {
          expect(row.count).toBe(stateCounts[row.state]);
          telemetryTotal += row.count;
        }
        expect(telemetryTotal).toBe(TELEMETRY_ROWS);
        console.log(
          `telemetry insert: ${formatMs(telemetryInsertMs)} | telemetry group-by: ${formatMs(telemetryQueryMs)}`,
        );
      } finally {
        db.close();
        removeDbFiles(dbPath);
      }
    },
    0,
  );
});
