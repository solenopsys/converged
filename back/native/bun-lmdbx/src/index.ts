import { dlopen, FFIType, ptr, read } from "bun:ffi";
import { existsSync } from "fs";
import { join } from "path";

const SYMBOLS = {
  lmdbx_open: {
    args: [FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  lmdbx_close: {
    args: [FFIType.u64],
    returns: FFIType.void,
  },
  lmdbx_put: {
    args: [FFIType.u64, FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  lmdbx_get: {
    args: [FFIType.u64, FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  lmdbx_free: {
    args: [FFIType.u64, FFIType.u64],
    returns: FFIType.void,
  },
  lmdbx_del: {
    args: [FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  lmdbx_flush: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  lmdbx_txn_begin: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  lmdbx_txn_commit: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  lmdbx_txn_abort: {
    args: [FFIType.u64],
    returns: FFIType.void,
  },
  lmdbx_cursor_open: {
    args: [FFIType.u64, FFIType.ptr],
    returns: FFIType.i32,
  },
  lmdbx_cursor_close: {
    args: [FFIType.u64],
    returns: FFIType.void,
  },
  lmdbx_cursor_get: {
    args: [FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
} as const;

function resolveArch(runtimeArch: string): string {
  switch (runtimeArch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported architecture '${runtimeArch}' for lmdbx native bindings`);
  }
}

function detectLibcVariant(): "gnu" | "musl" | undefined {
  if (process.platform !== "linux") {
    return undefined;
  }

  const report = (process as any).report?.getReport?.();
  const glibcVersion = report?.header?.glibcVersionRuntime;
  if (typeof glibcVersion === "string" && glibcVersion.length > 0) {
    return "gnu";
  }

  const muslMarkers = [
    "/lib/ld-musl-x86_64.so.1",
    "/lib/ld-musl-aarch64.so.1",
    "/lib/ld-musl.so.1",
  ];

  if (muslMarkers.some((marker) => existsSync(marker))) {
    return "musl";
  }

  return undefined;
}

function getLibPath(): string {
  const arch = resolveArch(process.arch);
  const libc = detectLibcVariant() || "gnu";
  const filename = `liblmdbx-${arch}-${libc}.so`;
  const binLibsDir = process.env.BIN_LIBS_PATH;
  if (binLibsDir && binLibsDir.length > 0) {
    return join(binLibsDir, filename);
  }
  return `${import.meta.dir}/../bin-libs/${filename}`;
}

const lib = dlopen(getLibPath(), SYMBOLS);

export class Database {
  private db: bigint;
  private resultPtr = new BigUint64Array(1);
  private resultLen = new BigUint64Array(1);

  constructor(path: string) {
    const dbPtr = new BigUint64Array(1);
    const rc = lib.symbols.lmdbx_open(Buffer.from(path + "\0"), ptr(dbPtr));
    if (rc !== 0) throw new Error(`Failed to open database: ${rc}`);
    this.db = dbPtr[0];
  }

  put(key: string | Buffer, value: string | Buffer): void {
    const k = Buffer.isBuffer(key) ? key : Buffer.from(key);
    const v = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const rc = lib.symbols.lmdbx_put(this.db, ptr(k), BigInt(k.length), ptr(v), BigInt(v.length));
    if (rc !== 0) throw new Error(`Put failed: ${rc}`);
  }

  get(key: string | Buffer): Buffer | null {
    const k = Buffer.isBuffer(key) ? key : Buffer.from(key);
    const rc = lib.symbols.lmdbx_get(this.db, ptr(k), BigInt(k.length), ptr(this.resultPtr), ptr(this.resultLen));

    if (rc === -2) return null;
    if (rc !== 0) throw new Error(`Get failed: ${rc}`);

    const dataPtr = Number(this.resultPtr[0]);
    const len = Number(this.resultLen[0]);
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buf[i] = read.u8(dataPtr, i);
    }
    lib.symbols.lmdbx_free(this.resultPtr[0], BigInt(len));
    return Buffer.from(buf);
  }

  delete(key: string | Buffer): void {
    const k = Buffer.isBuffer(key) ? key : Buffer.from(key);
    const rc = lib.symbols.lmdbx_del(this.db, ptr(k), BigInt(k.length));
    if (rc !== 0) throw new Error(`Delete failed: ${rc}`);
  }

  flush(): void {
    const rc = lib.symbols.lmdbx_flush(this.db);
    if (rc !== 0) throw new Error(`Flush failed: ${rc}`);
  }

  beginTransaction(): void {
    const rc = lib.symbols.lmdbx_txn_begin(this.db);
    if (rc !== 0) throw new Error(`Begin transaction failed: ${rc}`);
  }

  commitTransaction(): void {
    const rc = lib.symbols.lmdbx_txn_commit(this.db);
    if (rc !== 0) throw new Error(`Commit transaction failed: ${rc}`);
  }

  abortTransaction(): void {
    lib.symbols.lmdbx_txn_abort(this.db);
  }

  transaction<T>(fn: () => T): T {
    this.beginTransaction();
    try {
      const result = fn();
      this.commitTransaction();
      return result;
    } catch (err) {
      this.abortTransaction();
      throw err;
    }
  }

  getRange(options?: {
    start?: string | Buffer,
    end?: string | Buffer,
    limit?: number,
    reverse?: boolean
  }) {
    const cursorPtr = new BigUint64Array(1);
    const rc = lib.symbols.lmdbx_cursor_open(this.db, ptr(cursorPtr));
    if (rc !== 0) throw new Error(`Cursor open failed: ${rc}`);

    const cursor = cursorPtr[0];
    const keyPtr = new BigUint64Array(1);
    const keyLen = new BigUint64Array(1);
    const valuePtr = new BigUint64Array(1);
    const valueLen = new BigUint64Array(1);

    const MDBX_FIRST = 0;
    const MDBX_NEXT = 8;
    const results: Array<{ key: Buffer, value: Buffer }> = [];

    let op = MDBX_FIRST;
    let count = 0;
    const maxLimit = options?.limit || 1000000;

    while (count < maxLimit) {
      const rc = lib.symbols.lmdbx_cursor_get(cursor, ptr(keyPtr), ptr(keyLen), ptr(valuePtr), ptr(valueLen), op);
      if (rc !== 0) break;

      const kLen = Number(keyLen[0]);
      const vLen = Number(valueLen[0]);
      const kPtr = Number(keyPtr[0]);
      const vPtr = Number(valuePtr[0]);

      const key = Buffer.alloc(kLen);
      const value = Buffer.alloc(vLen);

      for (let i = 0; i < kLen; i++) key[i] = read.u8(kPtr, i);
      for (let i = 0; i < vLen; i++) value[i] = read.u8(vPtr, i);

      results.push({ key, value });
      count++;
      op = MDBX_NEXT;
    }

    lib.symbols.lmdbx_cursor_close(cursor);
    return results;
  }

  close(): void {
    lib.symbols.lmdbx_close(this.db);
  }
}
