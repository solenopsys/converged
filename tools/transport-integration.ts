import { existsSync, rmSync } from "fs";
import { resolve } from "path";
import net from "node:net";
import { StorageConnection } from "../back/native/bun-transport/src/index";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const CLARITY_ROOT = resolve(PROJECT_ROOT, "../..");
const STORAGE_BIN = resolve(PROJECT_ROOT, "native/storage/zig-out/bin/storage");
const DATA_DIR = resolve(PROJECT_ROOT, "../../data");
const SOCKET_PATH = "/tmp/storage-socket/storage-integration.sock";
const FAKE_SOCKET_PATH = "/tmp/storage-socket/storage-timeout.sock";
const MISSING_SOCKET_PATH = "/tmp/storage-socket/storage-missing.sock";

async function waitForSocket(path: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(path)) {
      return;
    }
    await Bun.sleep(50);
  }
  throw new Error(`Socket did not appear in ${timeoutMs}ms: ${path}`);
}

async function main() {
  if (existsSync(SOCKET_PATH)) {
    rmSync(SOCKET_PATH, { force: true });
  }

  const proc = Bun.spawn({
    cmd: [
      STORAGE_BIN,
      "start",
      "--data-dir",
      DATA_DIR,
      "--socket",
      SOCKET_PATH,
    ],
    cwd: CLARITY_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    await waitForSocket(SOCKET_PATH, 10_000);
    await Bun.sleep(100);

    for (let i = 0; i < 8; i++) {
      const conn = new StorageConnection(SOCKET_PATH, {
        operationTimeoutMs: 1_000,
      });
      try {
        conn.ping();
        conn.ping();

        const storesFirst = conn.listStores();
        if (storesFirst.length === 0) {
          throw new Error("Expected at least one store from listStores()");
        }

        const storesSecond = conn.listStores();
        if (storesSecond.length !== storesFirst.length) {
          throw new Error(
            `listStores() changed unexpectedly: ${storesFirst.length} -> ${storesSecond.length}`,
          );
        }

        conn.open("usage-ms", "usage", "sql");
      } finally {
        conn.close();
      }
    }

    if (existsSync(FAKE_SOCKET_PATH)) {
      rmSync(FAKE_SOCKET_PATH, { force: true });
    }

    const fakeServer = net.createServer((socket) => {
      socket.on("data", () => {
        // Intentionally consume and never respond: client must timeout.
      });
    });
    await new Promise<void>((resolvePromise, reject) => {
      fakeServer.once("error", reject);
      fakeServer.listen(FAKE_SOCKET_PATH, () => {
        fakeServer.off("error", reject);
        resolvePromise();
      });
    });

    try {
      const started = Date.now();
      const timeoutConn = new StorageConnection(FAKE_SOCKET_PATH, {
        operationTimeoutMs: 150,
      });
      try {
        let gotTimeoutError = false;
        try {
          timeoutConn.ping();
        } catch (error) {
          const msg = String(error);
          if (!/timeout/i.test(msg)) {
            throw new Error(`Expected timeout error, got: ${msg}`);
          }
          gotTimeoutError = true;
        }
        if (!gotTimeoutError) {
          throw new Error(
            "Expected ping() to fail by timeout, but it succeeded",
          );
        }

        const elapsed = Date.now() - started;
        if (elapsed > 2_000) {
          throw new Error(`Timeout response is too slow: ${elapsed}ms`);
        }
      } finally {
        timeoutConn.close();
      }
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        fakeServer.close((err) => (err ? reject(err) : resolvePromise()));
      });
      if (existsSync(FAKE_SOCKET_PATH)) {
        rmSync(FAKE_SOCKET_PATH, { force: true });
      }
    }

    const verify = new StorageConnection(SOCKET_PATH, {
      operationTimeoutMs: 1_000,
    });
    let storesCount = 0;
    try {
      storesCount = verify.listStores().length;
    } finally {
      verify.close();
    }

    if (existsSync(MISSING_SOCKET_PATH)) {
      rmSync(MISSING_SOCKET_PATH, { force: true });
    }
    let gotMissingSocketError = false;
    try {
      // Must fail with a clear and predictable message.
      new StorageConnection(MISSING_SOCKET_PATH);
    } catch (error) {
      const msg = String(error);
      if (!/socket not found/i.test(msg)) {
        throw new Error(`Expected missing socket message, got: ${msg}`);
      }
      gotMissingSocketError = true;
    }
    if (!gotMissingSocketError) {
      throw new Error("Expected constructor to fail for missing socket");
    }

    console.log(
      `[transport-integration] OK: sequential reconnect + timeout checks passed (${storesCount} stores)`,
    );
  } finally {
    proc.kill();
    await proc.exited;
  }
}

main().catch((error) => {
  console.error("[transport-integration] FAILED");
  console.error(error);
  process.exit(1);
});
