/**
 * store-check — lists open storage databases via bun-transport
 *
 * Usage:
 *   bun run store-check
 *   STORAGE_SOCKET_PATH=/tmp/storage-socket/storage.sock bun run store-check
 */

import { StorageConnection } from "bun-transport";

const socketPath =
  process.env.STORAGE_SOCKET_PATH ?? "/tmp/storage-socket/storage.sock";

interface StoreEntry {
  ms: string;
  store: string;
  storeType: string;
  version: number;
  migrations: number;
}

function printTable(entries: StoreEntry[]): void {
  if (entries.length === 0) {
    console.log("No stores open.");
    return;
  }

  const headers = ["Microservice", "Store", "Type", "Ver", "Migrations"];
  const widths = headers.map((h, i) => {
    const vals = entries.map((e) =>
      [e.ms, e.store, e.storeType, String(e.version), String(e.migrations)][i]
    );
    return Math.max(h.length, ...vals.map((v) => v.length));
  });

  const top = "┌─" + widths.map((w) => "─".repeat(w)).join("─┬─") + "─┐";
  const sep = "├─" + widths.map((w) => "─".repeat(w)).join("─┼─") + "─┤";
  const bot = "└─" + widths.map((w) => "─".repeat(w)).join("─┴─") + "─┘";
  const row = (cols: string[]) =>
    "│ " + cols.map((c, i) => c.padEnd(widths[i])).join(" │ ") + " │";

  console.log(top);
  console.log(row(headers));
  for (const e of entries) {
    console.log(sep);
    console.log(row([e.ms, e.store, e.storeType, String(e.version), String(e.migrations)]));
  }
  console.log(bot);
}

async function main() {
  console.log(`Connecting to: ${socketPath}\n`);

  let conn: StorageConnection;
  try {
    conn = new StorageConnection(socketPath);
  } catch (e) {
    console.error(`✗ Cannot connect: ${e}`);
    process.exit(1);
  }

  try {
    conn.ping();
    console.log("✓ Storage server is up\n");
  } catch (e) {
    console.error(`✗ Ping failed: ${e}`);
    conn.close();
    process.exit(1);
  }

  let storeKeys: string[];
  try {
    storeKeys = conn.listStores();
  } catch (e) {
    console.error(`✗ listStores failed: ${e}`);
    conn.close();
    process.exit(1);
  }

  const entries: StoreEntry[] = [];
  for (const key of storeKeys) {
    const slash = key.indexOf("/");
    const ms = slash >= 0 ? key.slice(0, slash) : key;
    const store = slash >= 0 ? key.slice(slash + 1) : "";
    try {
      const manifest = conn.getManifest(ms, store);
      entries.push({
        ms,
        store,
        storeType: manifest.storeType,
        version: manifest.version,
        migrations: manifest.migrations.length,
      });
    } catch {
      entries.push({ ms, store, storeType: "?", version: 0, migrations: 0 });
    }
  }

  printTable(entries);
  console.log(`\nTotal: ${entries.length} stores`);

  conn.close();
}

main();
