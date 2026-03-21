/**
 * End-to-end integration test for all storage engines.
 *
 * Spawns the storage server, connects via bun-transport, and runs
 * full CRUD cycles for every store type: SQL, KEY_VALUE, COLUMN, VECTOR, FILES, GRAPH.
 *
 * Usage:  bun run storage-it.ts
 */

import { spawn } from "bun";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dir);
const STORAGE_BIN = join(ROOT, "storage/zig-out/bin/storage");
const RYUGRAPH_LIB = join(ROOT, "wrapers/ryugraph/zig-out/lib/libryugraph.so");
const TRANSPORT_LIB_DIR = join(ROOT, "../back/native/bun-transport/bin-libs");
const TEST_DIR = "/tmp/storage-it-" + Date.now();
const DATA_DIR = join(TEST_DIR, "data");
const SOCKET_PATH = join(TEST_DIR, "storage.sock");

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function assertEq(a: unknown, b: unknown, msg: string) {
  const sa = typeof a === "bigint" ? a.toString() : JSON.stringify(a);
  const sb = typeof b === "bigint" ? b.toString() : JSON.stringify(b);
  if (sa !== sb) throw new Error(`ASSERT_EQ FAILED: ${msg}\n  got:      ${sa}\n  expected: ${sb}`);
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = e?.message ?? String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}`);
    console.log(`    ${msg}`);
  }
}

async function waitForSocket(path: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(path)) return;
    await Bun.sleep(100);
  }
  throw new Error(`socket ${path} did not appear within ${timeoutMs}ms`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Clean & create test dir
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });

  console.log(`storage binary: ${STORAGE_BIN}`);
  console.log(`data dir:       ${DATA_DIR}`);
  console.log(`socket:         ${SOCKET_PATH}`);
  console.log();

  // Start storage server
  const server = spawn({
    cmd: [STORAGE_BIN, "start", "--data-dir", DATA_DIR, "--socket", SOCKET_PATH],
    env: {
      ...process.env,
      RYUGRAPH_LIBRARY_PATH: RYUGRAPH_LIB,
    },
    stdout: "inherit",
    stderr: "inherit",
  });

  try {
    await waitForSocket(SOCKET_PATH);
    console.log("server started\n");

    // Dynamic import so the FFI library loads after we set env
    process.env.BIN_LIBS_PATH = TRANSPORT_LIB_DIR;
    const { StorageConnection } = await import("../back/native/bun-transport/src/index.ts");
    const conn = new StorageConnection(SOCKET_PATH);

    // ── Ping ──
    await test("ping", () => {
      conn.ping();
    });

    // ── SQL ──────────────────────────────────────────────────────────────────
    console.log("\n── SQL ──");

    await test("sql: open", () => {
      conn.open("it", "sqldb", "sql");
    });

    await test("sql: create table", () => {
      conn.execSql("it", "sqldb", "CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, score REAL)");
    });

    await test("sql: insert", () => {
      conn.execSql("it", "sqldb", "INSERT INTO users VALUES(1, 'alice', 9.5)");
      conn.execSql("it", "sqldb", "INSERT INTO users VALUES(2, 'bob', 7.2)");
      conn.execSql("it", "sqldb", "INSERT INTO users VALUES(3, 'carol', 8.8)");
    });

    await test("sql: query", () => {
      const rows = conn.querySql("it", "sqldb", "SELECT * FROM users ORDER BY id");
      assertEq(rows.length, 3, "row count");
      assertEq(rows[0].name, "alice", "row 0 name");
      assertEq(rows[1].name, "bob", "row 1 name");
    });

    await test("sql: update + verify", () => {
      conn.execSql("it", "sqldb", "UPDATE users SET score = 10.0 WHERE id = 1");
      const rows = conn.querySql("it", "sqldb", "SELECT score FROM users WHERE id = 1");
      assertEq(rows.length, 1, "row count after update");
    });

    await test("sql: delete + verify", () => {
      conn.execSql("it", "sqldb", "DELETE FROM users WHERE id = 3");
      const rows = conn.querySql("it", "sqldb", "SELECT * FROM users");
      assertEq(rows.length, 2, "row count after delete");
    });

    await test("sql: size > 0", () => {
      const sz = conn.getSize("it", "sqldb");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    await test("sql: manifest", () => {
      const m = conn.getManifest("it", "sqldb");
      assertEq(m.storeType, "sql", "manifest type");
      assertEq(m.name, "sqldb", "manifest name");
    });

    await test("sql: migration tracking", () => {
      conn.recordMigration("it", "sqldb", "m001");
      conn.recordMigration("it", "sqldb", "m002");
      const m = conn.getManifest("it", "sqldb");
      assert(m.migrations.includes("m001"), "should have m001");
      assert(m.migrations.includes("m002"), "should have m002");
    });

    // ── KEY_VALUE ────────────────────────────────────────────────────────────
    console.log("\n── KEY_VALUE ──");

    await test("kv: open", () => {
      conn.open("it", "kvdb", "kv");
    });

    await test("kv: put + get", () => {
      conn.kvPut("it", "kvdb", "key1", Buffer.from("value1"));
      conn.kvPut("it", "kvdb", "key2", Buffer.from("value2"));
      const val = conn.kvGet("it", "kvdb", "key1");
      assert(val !== null, "key1 should exist");
      assertEq(val!.toString(), "value1", "key1 value");
    });

    await test("kv: get missing key returns null", () => {
      const val = conn.kvGet("it", "kvdb", "nonexistent");
      assertEq(val, null, "missing key should return null");
    });

    await test("kv: overwrite", () => {
      conn.kvPut("it", "kvdb", "key1", Buffer.from("updated"));
      const val = conn.kvGet("it", "kvdb", "key1");
      assertEq(val!.toString(), "updated", "overwritten value");
    });

    await test("kv: delete", () => {
      conn.kvDelete("it", "kvdb", "key1");
      const val = conn.kvGet("it", "kvdb", "key1");
      assertEq(val, null, "deleted key should be null");
    });

    await test("kv: range scan", () => {
      conn.kvPut("it", "kvdb", "prefix:a", Buffer.from("A"));
      conn.kvPut("it", "kvdb", "prefix:b", Buffer.from("B"));
      conn.kvPut("it", "kvdb", "other:x", Buffer.from("X"));
      const keys = conn.kvList("it", "kvdb", "prefix:");
      assert(keys.length >= 2, `prefix scan should return >= 2, got ${keys.length}`);
      assert(keys.every(k => k.startsWith("prefix:")), "all keys should have prefix");
    });

    await test("kv: size > 0", () => {
      const sz = conn.getSize("it", "kvdb");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    // ── COLUMN ───────────────────────────────────────────────────────────────
    console.log("\n── COLUMN ──");

    await test("column: open", () => {
      conn.open("it", "coldb", "column");
    });

    await test("column: create table + insert", () => {
      conn.execSql("it", "coldb", "CREATE TABLE metrics(ts INTEGER, sensor TEXT, value REAL)");
      for (let i = 0; i < 10; i++) {
        conn.execSql("it", "coldb", `INSERT INTO metrics VALUES(${1000 + i}, 'temp', ${20.0 + i * 0.1})`);
      }
    });

    await test("column: query", () => {
      const rows = conn.querySql("it", "coldb", "SELECT * FROM metrics ORDER BY ts");
      assertEq(rows.length, 10, "row count");
    });

    await test("column: aggregation", () => {
      const rows = conn.querySql("it", "coldb", "SELECT COUNT(*) as cnt, AVG(value) as avg_val FROM metrics");
      assertEq(rows.length, 1, "agg row count");
    });

    await test("column: size > 0", () => {
      const sz = conn.getSize("it", "coldb");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    // ── VECTOR ───────────────────────────────────────────────────────────────
    console.log("\n── VECTOR ──");

    await test("vector: open", () => {
      conn.open("it", "vecdb", "vector");
    });

    await test("vector: create regular table", () => {
      conn.execSql("it", "vecdb", "CREATE TABLE items(id INTEGER PRIMARY KEY, label TEXT)");
      conn.execSql("it", "vecdb", "INSERT INTO items VALUES(1, 'cat')");
      conn.execSql("it", "vecdb", "INSERT INTO items VALUES(2, 'dog')");
    });

    await test("vector: create virtual table + insert vectors", () => {
      conn.execSql("it", "vecdb", "CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[4])");
      conn.execSql("it", "vecdb", "INSERT INTO vec_items(rowid, embedding) VALUES(1, '[1.0, 0.0, 0.0, 0.0]')");
      conn.execSql("it", "vecdb", "INSERT INTO vec_items(rowid, embedding) VALUES(2, '[0.0, 1.0, 0.0, 0.0]')");
    });

    await test("vector: knn query", () => {
      const rows = conn.querySql("it", "vecdb",
        "SELECT rowid, distance FROM vec_items WHERE embedding MATCH '[1.0, 0.0, 0.0, 0.0]' ORDER BY distance LIMIT 2");
      assertEq(rows.length, 2, "knn should return 2 results");
    });

    await test("vector: size > 0", () => {
      const sz = conn.getSize("it", "vecdb");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    // ── FILES ────────────────────────────────────────────────────────────────
    console.log("\n── FILES ──");

    await test("files: open", () => {
      conn.open("it", "filestore", "files");
    });

    await test("files: put + get", () => {
      conn.filePut("it", "filestore", "doc/readme.txt", Buffer.from("hello world"));
      conn.filePut("it", "filestore", "doc/notes.txt", Buffer.from("some notes"));
      const data = conn.fileGet("it", "filestore", "doc/readme.txt");
      assert(data !== null, "file should exist");
      assertEq(data!.toString(), "hello world", "file content");
    });

    await test("files: get missing returns null", () => {
      const data = conn.fileGet("it", "filestore", "nonexistent.txt");
      assertEq(data, null, "missing file should return null");
    });

    await test("files: list", () => {
      const keys = conn.fileList("it", "filestore");
      assert(keys.length >= 2, `should have >= 2 files, got ${keys.length}`);
    });

    await test("files: overwrite", () => {
      conn.filePut("it", "filestore", "doc/readme.txt", Buffer.from("updated content"));
      const data = conn.fileGet("it", "filestore", "doc/readme.txt");
      assertEq(data!.toString(), "updated content", "overwritten file content");
    });

    await test("files: delete", () => {
      conn.fileDelete("it", "filestore", "doc/notes.txt");
      const data = conn.fileGet("it", "filestore", "doc/notes.txt");
      assertEq(data, null, "deleted file should be null");
    });

    await test("files: size > 0", () => {
      const sz = conn.getSize("it", "filestore");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    // ── GRAPH ────────────────────────────────────────────────────────────────
    console.log("\n── GRAPH ──");

    await test("graph: open", () => {
      conn.open("it", "graphdb", "graph");
    });

    await test("graph: create nodes", () => {
      conn.execSql("it", "graphdb", "CREATE NODE TABLE Person(name STRING, age INT64, PRIMARY KEY(name))");
      conn.execSql("it", "graphdb", "CREATE NODE TABLE City(name STRING, PRIMARY KEY(name))");
      conn.execSql("it", "graphdb", "CREATE REL TABLE LivesIn(FROM Person TO City)");
    });

    await test("graph: insert data", () => {
      conn.execSql("it", "graphdb", "CREATE (:Person {name: 'Alice', age: 30})");
      conn.execSql("it", "graphdb", "CREATE (:Person {name: 'Bob', age: 25})");
      conn.execSql("it", "graphdb", "CREATE (:City {name: 'Berlin'})");
      conn.execSql("it", "graphdb", "MATCH (a:Person {name: 'Alice'}), (c:City {name: 'Berlin'}) CREATE (a)-[:LivesIn]->(c)");
    });

    await test("graph: query nodes", () => {
      const rows = conn.querySql("it", "graphdb", "MATCH (p:Person) RETURN p.name, p.age ORDER BY p.name");
      assert(rows.length > 0, "should return graph results");
    });

    await test("graph: query relationships", () => {
      const rows = conn.querySql("it", "graphdb", "MATCH (p:Person)-[:LivesIn]->(c:City) RETURN p.name, c.name");
      assert(rows.length > 0, "should return relationship results");
    });

    await test("graph: size > 0", () => {
      const sz = conn.getSize("it", "graphdb");
      assert(sz > 0n, `size should be > 0, got ${sz}`);
    });

    // ── listStores ───────────────────────────────────────────────────────────
    console.log("\n── Global ──");

    await test("listStores returns all opened", () => {
      const stores = conn.listStores();
      assert(stores.length >= 6, `should have >= 6 stores, got ${stores.length}: ${stores.join(", ")}`);
    });

    // ── Close all stores ──
    await test("close all stores", () => {
      conn.close_store("it", "sqldb");
      conn.close_store("it", "kvdb");
      conn.close_store("it", "coldb");
      conn.close_store("it", "vecdb");
      conn.close_store("it", "filestore");
      conn.close_store("it", "graphdb");
    });

    await test("listStores after close is empty", () => {
      const stores = conn.listStores();
      assertEq(stores.length, 0, "all stores should be closed");
    });

    // ── Shutdown ──
    conn.shutdown();

  } finally {
    // Wait for server to exit
    const exitCode = await Promise.race([
      server.exited,
      Bun.sleep(3000).then(() => {
        server.kill();
        return server.exited;
      }),
    ]);
    console.log(`\nserver exited with code ${exitCode}`);

    // Cleanup
    rmSync(TEST_DIR, { recursive: true, force: true });
  }

  // ── Summary ──
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    for (const f of failures) console.log(`    - ${f}`);
  }
  console.log(`${"═".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(2);
});
