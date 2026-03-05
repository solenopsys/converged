import { dlopen, FFIType, ptr, CString, read } from "bun:ffi";
import { existsSync } from "fs";
import { dirname, join } from "path";

// ── Library loading ────────────────────────────────────────────────────────────

const SYMBOLS = {
  // Socket
  transport_connect:  { args: [FFIType.cstring],              returns: FFIType.i32 },
  transport_set_timeout_ms: { args: [FFIType.i32, FFIType.u32], returns: FFIType.i32 },
  transport_listen:   { args: [FFIType.cstring],              returns: FFIType.i32 },
  transport_accept:   { args: [FFIType.i32],                  returns: FFIType.i32 },
  transport_close:    { args: [FFIType.i32],                  returns: FFIType.void },
  transport_send_req: { args: [FFIType.i32, FFIType.ptr],     returns: FFIType.i32 },
  transport_recv_resp:{ args: [FFIType.i32],                  returns: FFIType.ptr },

  // Request builders
  transport_req_ping:       { args: [],                                                         returns: FFIType.ptr },
  transport_req_shutdown:   { args: [],                                                         returns: FFIType.ptr },
  transport_req_open:       { args: [FFIType.cstring, FFIType.cstring, FFIType.u8],            returns: FFIType.ptr },
  transport_req_close:      { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_exec_sql:   { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_query_sql:  { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_size:       { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_manifest:   { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_migrate:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_archive:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_put:     { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  transport_req_kv_get:     { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_delete:  { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_list:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_file_put:   { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  transport_req_file_get:   { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_file_delete:{ args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_file_list:  { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_free:       { args: [FFIType.ptr],                                             returns: FFIType.void },

  // Response accessors
  transport_resp_free:         { args: [FFIType.ptr], returns: FFIType.void },
  transport_resp_ok:           { args: [FFIType.ptr], returns: FFIType.i32 },
  transport_resp_error:        { args: [FFIType.ptr], returns: FFIType.ptr },
  transport_resp_duration_us:  { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_op_count:     { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_affected:     { args: [FFIType.ptr], returns: FFIType.i64 },
  transport_resp_size:         { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_row_count:    { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_col_count:    { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u32 },
  transport_resp_col_name:     { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.ptr },
  transport_resp_value_type:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i32 },
  transport_resp_value_int:    { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i64 },
  transport_resp_value_real:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.f64 },
  transport_resp_value_text:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.ptr },
  transport_resp_key_count:    { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_key_at:       { args: [FFIType.ptr, FFIType.u32], returns: FFIType.ptr },
  transport_resp_found:        { args: [FFIType.ptr], returns: FFIType.i32 },
  transport_resp_data_ptr:     { args: [FFIType.ptr], returns: FFIType.ptr },
  transport_resp_data_len:     { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_manifest_name:             { args: [FFIType.ptr], returns: FFIType.ptr },
  transport_resp_manifest_type:             { args: [FFIType.ptr], returns: FFIType.u8 },
  transport_resp_manifest_version:          { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_manifest_migration_count:  { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_manifest_migration_at:     { args: [FFIType.ptr, FFIType.u32], returns: FFIType.ptr },
  // KV pairs
  transport_resp_pair_count:     { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_pair_key_at:    { args: [FFIType.ptr, FFIType.u32], returns: FFIType.ptr },
  transport_resp_pair_value_ptr: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.ptr },
  transport_resp_pair_value_len: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u64 },
} as const;

function getLibPath(): string {
  const arch = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch;
  const libc = process.env.LIBC_VARIANT || "gnu";
  const filename = `libtransport-${arch}-${libc}.so`;
  const binLibsDir = process.env.BIN_LIBS_PATH;
  if (binLibsDir && binLibsDir.length > 0) return join(binLibsDir, filename);
  return `${import.meta.dir}/../bin-libs/${filename}`;
}

const lib = dlopen(getLibPath(), SYMBOLS);
const s   = lib.symbols;
const ENABLE_REQ_FREE = process.env.TRANSPORT_DISABLE_REQ_FREE !== "1";
const ENABLE_RESP_FREE = process.env.TRANSPORT_DISABLE_RESP_FREE !== "1";

export type StorageTransportErrorCode =
  | "INVALID_SOCKET_PATH"
  | "SOCKET_DIR_NOT_FOUND"
  | "SOCKET_NOT_FOUND"
  | "CONNECT_EXCEPTION"
  | "CONNECT_FAILED"
  | "SET_TIMEOUT_EXCEPTION"
  | "SET_TIMEOUT_FAILED"
  | "NOT_CONNECTED"
  | "SEND_EXCEPTION"
  | "SEND_FAILED"
  | "RECV_EXCEPTION"
  | "RECV_TIMEOUT_OR_CLOSED"
  | "REMOTE_ERROR"
  | "DECODE_JSON_ERROR";

export class StorageTransportError extends Error {
  readonly code: StorageTransportErrorCode;
  readonly socketPath?: string;

  constructor(
    code: StorageTransportErrorCode,
    message: string,
    options?: { socketPath?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "StorageTransportError";
    this.code = code;
    this.socketPath = options?.socketPath;
    if (options && "cause" in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export const StoreType = { sql: 0, kv: 1, column: 2, vector: 3, files: 4 } as const;
export type  StoreTypeKey = keyof typeof StoreType;

export const ValueType = { null: 0, integer: 1, real: 2, text: 3, blob: 4 } as const;

export interface Telemetry { durationUs: bigint; opCount: number; }

export interface Row { [column: string]: null | bigint | number | string | Buffer; }

export interface ManifestInfo {
  name: string;
  storeType: StoreTypeKey;
  version: number;
  migrations: string[];
}

export interface StorageConnectionOptions {
  operationTimeoutMs?: number;
}

// ── Connection ────────────────────────────────────────────────────────────────

export class StorageConnection {
  private fd: number = -1;
  private readonly socketPath: string;

  constructor(socketPath: string, options?: StorageConnectionOptions) {
    this.socketPath = socketPath;
    this.validateSocketPath(socketPath);

    if (!existsSync(socketPath)) {
      throw new StorageTransportError(
        "SOCKET_NOT_FOUND",
        `storage socket not found: ${socketPath}`,
        { socketPath },
      );
    }

    const pathBuf = Buffer.from(socketPath + "\0");
    let fd: number;
    try {
      fd = s.transport_connect(ptr(pathBuf)) as number;
    } catch (cause) {
      throw new StorageTransportError(
        "CONNECT_EXCEPTION",
        `transport_connect threw an exception for socket: ${socketPath}`,
        { socketPath, cause },
      );
    }
    if (fd < 0) {
      throw new StorageTransportError(
        "CONNECT_FAILED",
        `transport_connect failed: ${fd} (socket: ${socketPath})`,
        { socketPath },
      );
    }
    this.fd = fd;

    if (options?.operationTimeoutMs !== undefined) {
      let rc: number;
      try {
        rc = s.transport_set_timeout_ms(this.fd, options.operationTimeoutMs >>> 0) as number;
      } catch (cause) {
        this.close();
        throw new StorageTransportError(
          "SET_TIMEOUT_EXCEPTION",
          `transport_set_timeout_ms threw an exception (socket: ${socketPath})`,
          { socketPath, cause },
        );
      }
      if (rc !== 0) {
        this.close();
        throw new StorageTransportError(
          "SET_TIMEOUT_FAILED",
          `transport_set_timeout_ms failed: ${rc} (socket: ${socketPath})`,
          { socketPath },
        );
      }
    }
  }

  private validateSocketPath(socketPath: string): void {
    if (typeof socketPath !== "string" || socketPath.trim().length === 0) {
      throw new StorageTransportError(
        "INVALID_SOCKET_PATH",
        "storage socket path is empty",
      );
    }
    const socketDir = dirname(socketPath);
    if (!existsSync(socketDir)) {
      throw new StorageTransportError(
        "SOCKET_DIR_NOT_FOUND",
        `storage socket directory not found: ${socketDir}`,
        { socketPath },
      );
    }
  }

  close(): void {
    if (this.fd >= 0) {
      s.transport_close(this.fd);
      this.fd = -1;
    }
  }

  // ── Internal send/recv ───────────────────────────────────────────────────

  private sendRecv(req: number): Response {
    if (this.fd < 0) {
      s.transport_req_free(req);
      throw new StorageTransportError(
        "NOT_CONNECTED",
        `storage transport is not connected (socket: ${this.socketPath})`,
        { socketPath: this.socketPath },
      );
    }

    let rc: number;
    try {
      rc = s.transport_send_req(this.fd, req) as number;
    } catch (cause) {
      if (ENABLE_REQ_FREE) s.transport_req_free(req);
      throw new StorageTransportError(
        "SEND_EXCEPTION",
        `transport_send_req threw an exception (socket: ${this.socketPath})`,
        { socketPath: this.socketPath, cause },
      );
    }
    if (rc !== 0) {
      if (ENABLE_REQ_FREE) s.transport_req_free(req);
      throw new StorageTransportError(
        "SEND_FAILED",
        `transport_send_req failed: ${rc} (timeout or socket error, socket: ${this.socketPath})`,
        { socketPath: this.socketPath },
      );
    }
    if (ENABLE_REQ_FREE) s.transport_req_free(req);

    let resp: number;
    try {
      resp = s.transport_recv_resp(this.fd) as number;
    } catch (cause) {
      throw new StorageTransportError(
        "RECV_EXCEPTION",
        `transport_recv_resp threw an exception (socket: ${this.socketPath})`,
        { socketPath: this.socketPath, cause },
      );
    }
    if (!resp) {
      throw new StorageTransportError(
        "RECV_TIMEOUT_OR_CLOSED",
        `transport timeout while waiting for response (or socket closed): ${this.socketPath}`,
        { socketPath: this.socketPath },
      );
    }
    return new Response(resp, this.socketPath);
  }

  // ── Store management ─────────────────────────────────────────────────────

  open(ms: string, store: string, storeType: StoreTypeKey): Telemetry {
    const req = s.transport_req_open(cstr(ms), cstr(store), StoreType[storeType]) as number;
    return this.sendRecv(req).telemetry();
  }

  close_store(ms: string, store: string): Telemetry {
    const req = s.transport_req_close(cstr(ms), cstr(store)) as number;
    return this.sendRecv(req).telemetry();
  }

  getSize(ms: string, store: string): bigint {
    const req  = s.transport_req_size(cstr(ms), cstr(store)) as number;
    const resp = this.sendRecv(req);
    return resp.size();
  }

  getManifest(ms: string, store: string): ManifestInfo {
    const req  = s.transport_req_manifest(cstr(ms), cstr(store)) as number;
    const resp = this.sendRecv(req);
    return resp.manifest();
  }

  recordMigration(ms: string, store: string, migrationId: string): Telemetry {
    const req = s.transport_req_migrate(cstr(ms), cstr(store), cstr(migrationId)) as number;
    return this.sendRecv(req).telemetry();
  }

  createArchive(ms: string, store: string, outputPath: string): Telemetry {
    const req = s.transport_req_archive(cstr(ms), cstr(store), cstr(outputPath)) as number;
    return this.sendRecv(req).telemetry();
  }

  // ── SQL / Column ─────────────────────────────────────────────────────────

  execSql(ms: string, store: string, sql: string): { rowsAffected: bigint; telemetry: Telemetry } {
    const req  = s.transport_req_exec_sql(cstr(ms), cstr(store), cstr(sql)) as number;
    const resp = this.sendRecv(req);
    return { rowsAffected: resp.affected(), telemetry: resp.telemetry() };
  }

  querySql(ms: string, store: string, sql: string): Row[] {
    const req  = s.transport_req_query_sql(cstr(ms), cstr(store), cstr(sql)) as number;
    const resp = this.sendRecv(req);
    return resp.rows();
  }

  // ── KV ───────────────────────────────────────────────────────────────────

  kvPut(ms: string, store: string, key: string, value: Buffer): Telemetry {
    const req = s.transport_req_kv_put(cstr(ms), cstr(store), cstr(key), ptr(value), BigInt(value.length)) as number;
    return this.sendRecv(req).telemetry();
  }

  kvGet(ms: string, store: string, key: string): Buffer | null {
    const req  = s.transport_req_kv_get(cstr(ms), cstr(store), cstr(key)) as number;
    const resp = this.sendRecv(req);
    return resp.foundData();
  }

  kvDelete(ms: string, store: string, key: string): boolean {
    const req  = s.transport_req_kv_delete(cstr(ms), cstr(store), cstr(key)) as number;
    const resp = this.sendRecv(req);
    return resp.found();
  }

  kvList(ms: string, store: string, prefix = ""): string[] {
    const req  = s.transport_req_kv_list(cstr(ms), cstr(store), cstr(prefix)) as number;
    const resp = this.sendRecv(req);
    return resp.pairs().map(p => p.key);
  }

  kvGetRange(ms: string, store: string, prefix = ""): Buffer[] {
    const req  = s.transport_req_kv_list(cstr(ms), cstr(store), cstr(prefix)) as number;
    const resp = this.sendRecv(req);
    return resp.pairs().map(p => p.value);
  }

  // ── Files ────────────────────────────────────────────────────────────────

  filePut(ms: string, store: string, key: string, data: Buffer): Telemetry {
    const req = s.transport_req_file_put(cstr(ms), cstr(store), cstr(key), ptr(data), BigInt(data.length)) as number;
    return this.sendRecv(req).telemetry();
  }

  fileGet(ms: string, store: string, key: string): Buffer | null {
    const req  = s.transport_req_file_get(cstr(ms), cstr(store), cstr(key)) as number;
    const resp = this.sendRecv(req);
    return resp.foundData();
  }

  fileDelete(ms: string, store: string, key: string): boolean {
    const req  = s.transport_req_file_delete(cstr(ms), cstr(store), cstr(key)) as number;
    const resp = this.sendRecv(req);
    return resp.found();
  }

  fileList(ms: string, store: string): string[] {
    const req  = s.transport_req_file_list(cstr(ms), cstr(store)) as number;
    const resp = this.sendRecv(req);
    return resp.keys();
  }

  /** Returns all open store keys in "ms/store" format. */
  listStores(): string[] {
    const req  = s.transport_req_file_list(cstr(""), cstr("")) as number;
    const resp = this.sendRecv(req);
    return resp.keys();
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  ping(): void {
    const req = s.transport_req_ping() as number;
    this.sendRecv(req);
  }

  shutdown(): void {
    const req = s.transport_req_shutdown() as number;
    this.sendRecv(req);
  }
}

// ── Response helper ───────────────────────────────────────────────────────────

class Response {
  private handle: number;
  private readonly socketPath: string;

  constructor(handle: number, socketPath: string) {
    this.handle = handle;
    this.socketPath = socketPath;
    if (!(s.transport_resp_ok(handle) as number)) {
      const err = s.transport_resp_error(handle);
      this.free();
      throw new StorageTransportError(
        "REMOTE_ERROR",
        `storage error: ${err} (socket: ${socketPath})`,
        { socketPath },
      );
    }
  }

  private free(): void {
    if (!ENABLE_RESP_FREE || this.handle === 0) return;
    s.transport_resp_free(this.handle);
    (this as any).handle = 0;
  }

  telemetry(): Telemetry {
    const t: Telemetry = {
      durationUs: s.transport_resp_duration_us(this.handle) as bigint,
      opCount:    s.transport_resp_op_count(this.handle) as number,
    };
    this.free();
    return t;
  }

  affected(): bigint {
    const v = s.transport_resp_affected(this.handle) as bigint;
    this.free();
    return v;
  }

  size(): bigint {
    const v = s.transport_resp_size(this.handle) as bigint;
    this.free();
    return v;
  }

  rows(): Row[] {
    const dataLen = Number(s.transport_resp_data_len(this.handle) as bigint);
    if (dataLen > 0) {
      const dataPtr = Number(s.transport_resp_data_ptr(this.handle) as bigint);
      const buf = Buffer.allocUnsafe(dataLen);
      for (let i = 0; i < dataLen; i++) {
        buf[i] = read.u8(dataPtr, i);
      }
      this.free();
      let decoded: unknown;
      try {
        decoded = JSON.parse(buf.toString("utf8"));
      } catch (cause) {
        throw new StorageTransportError(
          "DECODE_JSON_ERROR",
          `failed to decode JSON response from storage (socket: ${this.socketPath})`,
          { socketPath: this.socketPath, cause },
        );
      }
      return Array.isArray(decoded) ? (decoded as Row[]) : [];
    }

    const count = s.transport_resp_row_count(this.handle) as number;
    const result: Row[] = [];
    for (let r = 0; r < count; r++) {
      const row: Row = {};
      const cols = s.transport_resp_col_count(this.handle, r) as number;
      for (let c = 0; c < cols; c++) {
        const colName = readCStr(s.transport_resp_col_name(this.handle, r, c));
        const vtype   = s.transport_resp_value_type(this.handle, r, c) as number;
        switch (vtype) {
          case 0:  row[colName] = null; break;
          case 1:  row[colName] = s.transport_resp_value_int(this.handle, r, c)  as bigint; break;
          case 2:  row[colName] = s.transport_resp_value_real(this.handle, r, c) as number; break;
          case 3:  row[colName] = readCStr(s.transport_resp_value_text(this.handle, r, c)); break;
          default: row[colName] = null;
        }
      }
      result.push(row);
    }
    this.free();
    return result;
  }

  keys(): string[] {
    const count  = s.transport_resp_key_count(this.handle) as number;
    const result = Array.from({ length: count }, (_, i) =>
      readCStr(s.transport_resp_key_at(this.handle, i))
    );
    this.free();
    return result;
  }

  pairs(): Array<{ key: string; value: Buffer }> {
    const count = s.transport_resp_pair_count(this.handle) as number;
    const result: Array<{ key: string; value: Buffer }> = [];
    for (let i = 0; i < count; i++) {
      const key    = readCStr(s.transport_resp_pair_key_at(this.handle, i));
      const valPtr = Number(s.transport_resp_pair_value_ptr(this.handle, i) as bigint);
      const valLen = Number(s.transport_resp_pair_value_len(this.handle, i) as bigint);
      const value  = Buffer.allocUnsafe(valLen);
      for (let j = 0; j < valLen; j++) value[j] = read.u8(valPtr, j);
      result.push({ key, value });
    }
    this.free();
    return result;
  }

  found(): boolean {
    const v = (s.transport_resp_found(this.handle) as number) === 1;
    this.free();
    return v;
  }

  foundData(): Buffer | null {
    const found = (s.transport_resp_found(this.handle) as number) === 1;
    if (!found) { this.free(); return null; }
    const dataPtr = Number(s.transport_resp_data_ptr(this.handle) as bigint);
    const dataLen = s.transport_resp_data_len(this.handle) as bigint;
    const len = Number(dataLen);
    const src = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) {
      src[i] = read.u8(dataPtr, i);
    }
    this.free();
    return src;
  }

  manifest(): ManifestInfo {
    const name    = readCStr(s.transport_resp_manifest_name(this.handle));
    const type_id = s.transport_resp_manifest_type(this.handle) as number;
    const version = s.transport_resp_manifest_version(this.handle) as number;
    const migCount = s.transport_resp_manifest_migration_count(this.handle) as number;
    const migrations = Array.from({ length: migCount }, (_, i) =>
      readCStr(s.transport_resp_manifest_migration_at(this.handle, i))
    );
    const typeKeys = Object.keys(StoreType) as StoreTypeKey[];
    this.free();
    return { name, storeType: typeKeys[type_id] ?? "sql", version, migrations };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cstr(s: string): Buffer { return Buffer.from(s + "\0"); }

/** Read a C string from an FFI return value.
 *  Bun may return: a JS string, a CString object, a Buffer (raw bytes), or a number/bigint pointer. */
function readCStr(raw: any): string {
  if (raw === null || raw === undefined || raw === 0 || raw === 0n) return "";
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) {
    const end = (raw as Buffer).indexOf(0);
    return (raw as Buffer).toString("utf8", 0, end >= 0 ? end : (raw as Buffer).length);
  }
  if (typeof raw === "object") return String(raw); // CString object — already decoded by Bun
  try { return new CString(raw).toString(); } catch { return ""; }
}
