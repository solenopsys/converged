import { dlopen, FFIType, ptr, CString, read } from "bun:ffi";
import { existsSync } from "fs";
import { join } from "path";

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
  transport_resp_error:        { args: [FFIType.ptr], returns: FFIType.cstring },
  transport_resp_duration_us:  { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_op_count:     { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_affected:     { args: [FFIType.ptr], returns: FFIType.i64 },
  transport_resp_size:         { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_row_count:    { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_col_count:    { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u32 },
  transport_resp_col_name:     { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.cstring },
  transport_resp_value_type:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i32 },
  transport_resp_value_int:    { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.i64 },
  transport_resp_value_real:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.f64 },
  transport_resp_value_text:   { args: [FFIType.ptr, FFIType.u32, FFIType.u32], returns: FFIType.cstring },
  transport_resp_key_count:    { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_key_at:       { args: [FFIType.ptr, FFIType.u32], returns: FFIType.cstring },
  transport_resp_found:        { args: [FFIType.ptr], returns: FFIType.i32 },
  transport_resp_data_ptr:     { args: [FFIType.ptr], returns: FFIType.ptr },
  transport_resp_data_len:     { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_manifest_name:             { args: [FFIType.ptr], returns: FFIType.cstring },
  transport_resp_manifest_type:             { args: [FFIType.ptr], returns: FFIType.u8 },
  transport_resp_manifest_version:          { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_manifest_migration_count:  { args: [FFIType.ptr], returns: FFIType.u32 },
  transport_resp_manifest_migration_at:     { args: [FFIType.ptr, FFIType.u32], returns: FFIType.cstring },
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
  private fd: number;

  constructor(socketPath: string, options?: StorageConnectionOptions) {
    const pathBuf = Buffer.from(socketPath + "\0");
    const fd = s.transport_connect(ptr(pathBuf)) as number;
    if (fd < 0) throw new Error(`transport_connect failed: ${fd}`);
    this.fd = fd;

    if (options?.operationTimeoutMs !== undefined) {
      const rc = s.transport_set_timeout_ms(this.fd, options.operationTimeoutMs >>> 0) as number;
      if (rc !== 0) {
        this.close();
        throw new Error(`transport_set_timeout_ms failed: ${rc}`);
      }
    }
  }

  close(): void {
    if (this.fd >= 0) {
      s.transport_close(this.fd);
      this.fd = -1;
    }
  }

  // ── Internal send/recv ───────────────────────────────────────────────────

  private sendRecv(req: bigint): Response {
    const rc = s.transport_send_req(this.fd, req) as number;
    if (rc !== 0) {
      s.transport_req_free(req);
      throw new Error(`transport_send_req failed: ${rc} (timeout or socket error)`);
    }
    s.transport_req_free(req);

    const resp = s.transport_recv_resp(this.fd) as bigint;
    if (!resp) throw new Error("transport timeout while waiting for response (or socket closed)");
    return new Response(resp);
  }

  // ── Store management ─────────────────────────────────────────────────────

  open(ms: string, store: string, storeType: StoreTypeKey): Telemetry {
    const req = s.transport_req_open(cstr(ms), cstr(store), StoreType[storeType]) as bigint;
    return this.sendRecv(req).telemetry();
  }

  close_store(ms: string, store: string): Telemetry {
    const req = s.transport_req_close(cstr(ms), cstr(store)) as bigint;
    return this.sendRecv(req).telemetry();
  }

  getSize(ms: string, store: string): bigint {
    const req  = s.transport_req_size(cstr(ms), cstr(store)) as bigint;
    const resp = this.sendRecv(req);
    return resp.size();
  }

  getManifest(ms: string, store: string): ManifestInfo {
    const req  = s.transport_req_manifest(cstr(ms), cstr(store)) as bigint;
    const resp = this.sendRecv(req);
    return resp.manifest();
  }

  recordMigration(ms: string, store: string, migrationId: string): Telemetry {
    const req = s.transport_req_migrate(cstr(ms), cstr(store), cstr(migrationId)) as bigint;
    return this.sendRecv(req).telemetry();
  }

  createArchive(ms: string, store: string, outputPath: string): Telemetry {
    const req = s.transport_req_archive(cstr(ms), cstr(store), cstr(outputPath)) as bigint;
    return this.sendRecv(req).telemetry();
  }

  // ── SQL / Column ─────────────────────────────────────────────────────────

  execSql(ms: string, store: string, sql: string): { rowsAffected: bigint; telemetry: Telemetry } {
    const req  = s.transport_req_exec_sql(cstr(ms), cstr(store), cstr(sql)) as bigint;
    const resp = this.sendRecv(req);
    return { rowsAffected: resp.affected(), telemetry: resp.telemetry() };
  }

  querySql(ms: string, store: string, sql: string): Row[] {
    const req  = s.transport_req_query_sql(cstr(ms), cstr(store), cstr(sql)) as bigint;
    const resp = this.sendRecv(req);
    return resp.rows();
  }

  // ── KV ───────────────────────────────────────────────────────────────────

  kvPut(ms: string, store: string, key: string, value: Buffer): Telemetry {
    const req = s.transport_req_kv_put(cstr(ms), cstr(store), cstr(key), ptr(value), BigInt(value.length)) as bigint;
    return this.sendRecv(req).telemetry();
  }

  kvGet(ms: string, store: string, key: string): Buffer | null {
    const req  = s.transport_req_kv_get(cstr(ms), cstr(store), cstr(key)) as bigint;
    const resp = this.sendRecv(req);
    return resp.foundData();
  }

  kvDelete(ms: string, store: string, key: string): boolean {
    const req  = s.transport_req_kv_delete(cstr(ms), cstr(store), cstr(key)) as bigint;
    const resp = this.sendRecv(req);
    return resp.found();
  }

  kvList(ms: string, store: string, prefix = ""): string[] {
    const req  = s.transport_req_kv_list(cstr(ms), cstr(store), cstr(prefix)) as bigint;
    const resp = this.sendRecv(req);
    return resp.keys();
  }

  // ── Files ────────────────────────────────────────────────────────────────

  filePut(ms: string, store: string, key: string, data: Buffer): Telemetry {
    const req = s.transport_req_file_put(cstr(ms), cstr(store), cstr(key), ptr(data), BigInt(data.length)) as bigint;
    return this.sendRecv(req).telemetry();
  }

  fileGet(ms: string, store: string, key: string): Buffer | null {
    const req  = s.transport_req_file_get(cstr(ms), cstr(store), cstr(key)) as bigint;
    const resp = this.sendRecv(req);
    return resp.foundData();
  }

  fileDelete(ms: string, store: string, key: string): boolean {
    const req  = s.transport_req_file_delete(cstr(ms), cstr(store), cstr(key)) as bigint;
    const resp = this.sendRecv(req);
    return resp.found();
  }

  fileList(ms: string, store: string): string[] {
    const req  = s.transport_req_file_list(cstr(ms), cstr(store)) as bigint;
    const resp = this.sendRecv(req);
    return resp.keys();
  }

  /** Returns all open store keys in "ms/store" format. */
  listStores(): string[] {
    const req  = s.transport_req_file_list(cstr(""), cstr("")) as bigint;
    const resp = this.sendRecv(req);
    return resp.keys();
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  ping(): void {
    const req = s.transport_req_ping() as bigint;
    this.sendRecv(req);
  }

  shutdown(): void {
    const req = s.transport_req_shutdown() as bigint;
    this.sendRecv(req);
  }
}

// ── Response helper ───────────────────────────────────────────────────────────

class Response {
  private handle: bigint;

  constructor(handle: bigint) {
    this.handle = handle;
    if (!(s.transport_resp_ok(handle) as number)) {
      const err = s.transport_resp_error(handle);
      this.free();
      throw new Error(`storage error: ${err}`);
    }
  }

  private free(): void { s.transport_resp_free(this.handle); }

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
      const decoded = JSON.parse(buf.toString("utf8"));
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
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) {
    const end = (raw as Buffer).indexOf(0);
    return (raw as Buffer).toString("utf8", 0, end >= 0 ? end : (raw as Buffer).length);
  }
  if (typeof raw === "object") return String(raw); // CString object — already decoded by Bun
  try { return new CString(raw).toString(); } catch { return ""; }
}
