import { dlopen, FFIType, ptr, toArrayBuffer, CString, read } from "bun:ffi";
import { existsSync } from "fs";
import { dirname, join } from "path";
import {
  MessageKind,
  MessagingConnection,
  PayloadCodec,
  type IncomingMessage,
} from "./messaging";
import {
  parseStorageErrorText,
  type StorageErrorCode,
} from "./storage-errors";

export {
  StorageErrorCodes,
  parseStorageErrorText,
  type StorageErrorCode,
} from "./storage-errors";

// behemoth always registers with fujin under this identity/service pair
// (see navite/apps/behemoth/src/server.zig) — not configurable per-instance.
const FUJIN_STORAGE_TARGET = "behemoth";
const FUJIN_STORAGE_SERVICE = "storage";
const FUJIN_REQUEST_TIMEOUT_MS = 20_000;

// ── Library loading ────────────────────────────────────────────────────────────

const SYMBOLS = {
  // Socket
  transport_connect:      { args: [FFIType.cstring],                returns: FFIType.i32 },
  transport_connect_tcp:  { args: [FFIType.cstring, FFIType.u16],   returns: FFIType.i32 },
  transport_set_timeout_ms: { args: [FFIType.i32, FFIType.u32],     returns: FFIType.i32 },
  transport_listen:       { args: [FFIType.cstring],                returns: FFIType.i32 },
  transport_accept:       { args: [FFIType.i32],                    returns: FFIType.i32 },
  transport_close:        { args: [FFIType.i32],                    returns: FFIType.void },
  transport_send_req:     { args: [FFIType.i32, FFIType.ptr],       returns: FFIType.i32 },
  transport_recv_resp:    { args: [FFIType.i32],                    returns: FFIType.ptr },
  transport_pool_create:  { args: [],                               returns: FFIType.ptr },
  transport_pool_free:    { args: [FFIType.ptr],                    returns: FFIType.void },
  transport_pool_set_default_unix: { args: [FFIType.ptr, FFIType.cstring], returns: FFIType.i32 },
  transport_pool_set_default_tcp:  { args: [FFIType.ptr, FFIType.cstring, FFIType.u16], returns: FFIType.i32 },
  transport_pool_add_unix: { args: [FFIType.ptr, FFIType.cstring, FFIType.cstring], returns: FFIType.i32 },
  transport_pool_add_tcp:  { args: [FFIType.ptr, FFIType.cstring, FFIType.cstring, FFIType.u16], returns: FFIType.i32 },
  transport_pool_remove:   { args: [FFIType.ptr, FFIType.cstring],  returns: FFIType.i32 },
  transport_pool_close_all:{ args: [FFIType.ptr],                   returns: FFIType.void },
  transport_pool_request:  { args: [FFIType.ptr, FFIType.cstring, FFIType.ptr], returns: FFIType.ptr },

  // Request builders
  transport_req_ping:       { args: [],                                                         returns: FFIType.ptr },
  transport_req_shutdown:   { args: [],                                                         returns: FFIType.ptr },
  transport_req_create:     { args: [FFIType.cstring, FFIType.cstring, FFIType.u8],            returns: FFIType.ptr },
  transport_req_open:       { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_close:      { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_exec_sql:   { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_query_sql:  { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_size:       { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_manifest:   { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_migrate:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_archive:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_put:     { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  transport_req_kv_put_from_cache: { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.cstring], returns: FFIType.ptr },
  transport_req_kv_get:     { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_get_to_cache: { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],   returns: FFIType.ptr },
  transport_req_kv_delete:  { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_kv_list:    { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_file_put:   { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  transport_req_file_get_to_cache: { args: [FFIType.cstring, FFIType.cstring, FFIType.cstring], returns: FFIType.ptr },
  transport_req_file_delete:{ args: [FFIType.cstring, FFIType.cstring, FFIType.cstring],       returns: FFIType.ptr },
  transport_req_file_list:  { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_kv_compact: { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_dump_create: { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_dump_list:   { args: [],                                                         returns: FFIType.ptr },
  transport_req_dump_delete: { args: [FFIType.cstring],                                          returns: FFIType.ptr },
  transport_req_dump_read:   { args: [FFIType.cstring, FFIType.u64, FFIType.u32],               returns: FFIType.ptr },
  transport_req_store_stats: { args: [FFIType.cstring, FFIType.cstring],                        returns: FFIType.ptr },
  transport_req_free:       { args: [FFIType.ptr],                                             returns: FFIType.void },

  // Cap'n Proto (de)serialization — used to ship the same request/response wire
  // payload over the fujin messaging channel instead of a direct ZMQ socket.
  transport_req_encode:     { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],                   returns: FFIType.i32 },
  transport_resp_decode:    { args: [FFIType.ptr, FFIType.u64],                                returns: FFIType.ptr },
  // First arg is a raw pointer value read back from a BigUint64Array out-param
  // (see encode above), not a ptr()-wrapped buffer — must be u64, matching the
  // lmdbx_free precedent, or Bun's FFI marshaller rejects the bigint.
  transport_free_buf:       { args: [FFIType.u64, FFIType.u64],                                returns: FFIType.void },

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
  transport_req_reader_file_name:    { args: [FFIType.ptr], returns: FFIType.ptr },
  transport_req_reader_dump_offset:  { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_req_reader_dump_length:  { args: [FFIType.ptr], returns: FFIType.u32 },
  // Store stats
  transport_resp_stats_cache_bytes: { args: [FFIType.ptr], returns: FFIType.u64 },
  transport_resp_stats_disk_bytes:  { args: [FFIType.ptr], returns: FFIType.u64 },
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

export const TRANSPORT_LIBRARY_PATH = getLibPath();
if (process.env.TRANSPORT_DEBUG_LOAD === "1") {
  console.log(`[bun-transport] loading native lib: ${TRANSPORT_LIBRARY_PATH}`);
}
const lib = dlopen(TRANSPORT_LIBRARY_PATH, SYMBOLS);
const s   = lib.symbols;
const ENABLE_REQ_FREE = process.env.TRANSPORT_DISABLE_REQ_FREE !== "1";
const ENABLE_RESP_FREE = process.env.TRANSPORT_DISABLE_RESP_FREE !== "1";

// Encode a built request (Cap'n Proto, same wire format the direct-socket path
// uses) into bytes so it can travel as a messaging payload instead of straight
// over a ZMQ REQ/REP frame. Pointer out-params come back as bigint (read from
// a BigUint64Array); Number()-coerce before handing to toArrayBuffer/free —
// see the free_buf u64 comment above for why raw bigints don't marshal as ptr.
function encodeReqBytes(req: number): Uint8Array {
  const outBuf = new BigUint64Array(1);
  const outLen = new BigUint64Array(1);
  const rc = s.transport_req_encode(req as any, ptr(outBuf), ptr(outLen)) as number;
  if (rc !== 0) {
    throw new StorageTransportError("SEND_FAILED", `transport_req_encode failed: ${rc}`);
  }
  const bufPtr = Number(outBuf[0]);
  const len = Number(outLen[0]);
  const bytes = new Uint8Array(toArrayBuffer(bufPtr as any, 0, len)).slice();
  s.transport_free_buf(BigInt(bufPtr), BigInt(len));
  return bytes;
}

function decodeRespBytes(bytes: Uint8Array): number {
  return s.transport_resp_decode(ptr(bytes), BigInt(bytes.byteLength)) as number;
}

function decodeErrorPayload(payload: Uint8Array): string {
  try {
    const body = JSON.parse(new TextDecoder().decode(payload)) as { error?: string };
    return body?.error ?? "";
  } catch {
    return "";
  }
}

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
  | "POOL_CREATE_FAILED"
  | "POOL_CONFIG_FAILED"
  | "POOL_REQUEST_FAILED"
  | "REMOTE_ERROR"
  | "DECODE_JSON_ERROR";

// ── Connection config ─────────────────────────────────────────────────────────

/** Unix domain socket connection. */
export interface UnixSocketConfig {
  kind: "unix";
  socketPath: string;
}

/** TCP socket connection — a direct connection to a storage engine's own listener. */
export interface TcpSocketConfig {
  kind: "tcp";
  host: string;
  port: number;
}

/**
 * Storage reached through the fujin messaging router instead of a direct
 * socket: `host`/`port` name the tenant's fujin ZMQ ROUTER endpoint, and every
 * request is addressed to the `behemoth`/`storage` peer over that channel.
 * This is the storage transport used in production (behemoth registers with
 * fujin as a DEALER and never binds a listener of its own).
 */
export interface FujinSocketConfig {
  kind: "fujin";
  host: string;
  port: number;
  target?: string;
  service?: string;
}

/** Pass this (or a plain socket-path string) to StorageConnection. */
export type StorageConnectionTargetConfig = UnixSocketConfig | TcpSocketConfig | FujinSocketConfig;

export interface PoolSocketConfig {
  kind: "pool";
  pool: NativeStorageConnectionPool;
  key?: string | (() => string | undefined);
  label?: string;
}

export type StorageConnectionConfig = StorageConnectionTargetConfig | PoolSocketConfig;

export class StorageTransportError extends Error {
  readonly code: StorageTransportErrorCode;
  readonly socketPath?: string;
  /** Set on REMOTE_ERROR: what storage itself refused to do. */
  readonly storageCode?: StorageErrorCode;
  /** Error text as storage sent it, without the code prefix. */
  readonly storageDetail?: string;

  constructor(
    code: StorageTransportErrorCode,
    message: string,
    options?: {
      socketPath?: string;
      cause?: unknown;
      storageCode?: StorageErrorCode;
      storageDetail?: string;
    },
  ) {
    super(message);
    this.name = "StorageTransportError";
    this.code = code;
    this.socketPath = options?.socketPath;
    this.storageCode = options?.storageCode;
    this.storageDetail = options?.storageDetail;
    if (options && "cause" in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  /** True when the store could not be reached because its volume is missing. */
  get isDataDirError(): boolean {
    return (
      this.storageCode === "DATA_DIR_NOT_CONFIGURED" ||
      this.storageCode === "DATA_DIR_NOT_MOUNTED" ||
      this.storageCode === "STORAGE_CONFIG_INVALID"
    );
  }
}

/** Builds the REMOTE_ERROR carrying whatever storage reported. */
function remoteStorageError(
  text: string,
  socketPath: string,
): StorageTransportError {
  const parsed = parseStorageErrorText(text || "unknown error");
  return new StorageTransportError(
    "REMOTE_ERROR",
    `storage error: ${parsed.message} (socket: ${socketPath})`,
    { socketPath, storageCode: parsed.code, storageDetail: parsed.detail },
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export const StoreType = { sql: 0, kv: 1, column: 2, vector: 3, files: 4, graph: 5 } as const;
export type  StoreTypeKey = keyof typeof StoreType;

export const ValueType = { null: 0, integer: 1, real: 2, text: 3, blob: 4 } as const;

export interface Telemetry { durationUs: bigint; opCount: number; }

export interface Row { [column: string]: null | bigint | number | string | Buffer; }

export interface StoreStats {
  /** RAM: SQLite page cache bytes or LMDBX used-pages bytes. 0 for files/graph. */
  cacheBytes: bigint;
  /** On-disk file size in bytes. */
  diskBytes: bigint;
}

export interface ManifestInfo {
  name: string;
  storeType: StoreTypeKey;
  version: number;
  migrations: string[];
}

export interface StorageConnectionOptions {
  operationTimeoutMs?: number;
  reconnectAttempts?: number;
}

// ── Native connection pool ───────────────────────────────────────────────────

export class NativeStorageConnectionPool {
  private handle: number;

  constructor(defaultConfig?: string | StorageConnectionTargetConfig) {
    this.handle = s.transport_pool_create() as number;
    if (!this.handle) {
      throw new StorageTransportError(
        "POOL_CREATE_FAILED",
        "failed to create native storage connection pool",
      );
    }
    if (defaultConfig) this.setDefault(defaultConfig);
  }

  setDefault(config: string | StorageConnectionTargetConfig): void {
    const normalized = normalizeConnectionConfig(config);
    const rc = this.applyConfig(undefined, normalized);
    if (rc !== 0) {
      throw new StorageTransportError(
        "POOL_CONFIG_FAILED",
        `failed to set default storage pool connection: ${connectionLabel(normalized)}`,
        { socketPath: connectionLabel(normalized) },
      );
    }
  }

  add(key: string, config: string | StorageConnectionTargetConfig): void {
    if (!key || key.trim().length === 0) {
      throw new StorageTransportError(
        "POOL_CONFIG_FAILED",
        "storage pool key is empty",
      );
    }
    const normalized = normalizeConnectionConfig(config);
    const rc = this.applyConfig(key, normalized);
    if (rc !== 0) {
      throw new StorageTransportError(
        "POOL_CONFIG_FAILED",
        `failed to add storage pool connection "${key}": ${connectionLabel(normalized)}`,
        { socketPath: connectionLabel(normalized) },
      );
    }
  }

  remove(key: string): boolean {
    const rc = s.transport_pool_remove(this.handle as any, cstr(key)) as number;
    return rc === 1;
  }

  closeAll(): void {
    try {
      s.transport_pool_close_all(this.handle as any);
    } catch {}
  }

  free(): void {
    if (!this.handle) return;
    const handle = this.handle;
    this.handle = 0;
    try {
      s.transport_pool_free(handle as any);
    } catch {}
  }

  request(key: string | undefined, makeReq: () => number, label: string): Response {
    if (!this.handle) {
      throw new StorageTransportError(
        "POOL_REQUEST_FAILED",
        `storage pool is closed (${label})`,
        { socketPath: label },
      );
    }

    const req = makeReq();
    if (!req) {
      throw new StorageTransportError(
        "SEND_FAILED",
        `failed to build transport request (pool: ${label})`,
        { socketPath: label },
      );
    }

    let resp: number;
    try {
      resp = s.transport_pool_request(this.handle as any, cstr(key ?? ""), req as any) as number;
    } catch (cause) {
      throw new StorageTransportError(
        "POOL_REQUEST_FAILED",
        `transport_pool_request threw an exception (pool: ${label})`,
        { socketPath: label, cause },
      );
    } finally {
      if (ENABLE_REQ_FREE) {
        try {
          s.transport_req_free(req as any);
        } catch {}
      }
    }

    if (!resp) {
      throw new StorageTransportError(
        "POOL_REQUEST_FAILED",
        `transport pool request failed (missing connection, timeout or socket error): ${label}`,
        { socketPath: label },
      );
    }
    return new Response(resp, label);
  }

  private applyConfig(key: string | undefined, config: StorageConnectionTargetConfig): number {
    if (config.kind === "unix") {
      const path = cstr(config.socketPath);
      return key === undefined
        ? s.transport_pool_set_default_unix(this.handle as any, path) as number
        : s.transport_pool_add_unix(this.handle as any, cstr(key), path) as number;
    }
    if (config.kind === "fujin") {
      throw new StorageTransportError(
        "POOL_CONFIG_FAILED",
        "fujin-routed storage connections do not use the native fd pool; " +
          "construct StorageConnection({ kind: \"fujin\", ... }) directly instead",
      );
    }
    const host = cstr(config.host);
    return key === undefined
      ? s.transport_pool_set_default_tcp(this.handle as any, host, config.port) as number
      : s.transport_pool_add_tcp(this.handle as any, cstr(key), host, config.port) as number;
  }
}

// ── Connection ────────────────────────────────────────────────────────────────

let fujinClientSeq = 0;

export class StorageConnection {
  private fd: number = -1;
  /** For Unix: filesystem path. For TCP/fujin: "host:port". Used in error messages. */
  private readonly socketPath: string;
  private readonly config: StorageConnectionConfig;
  private readonly operationTimeoutMs?: number;
  private readonly reconnectAttempts: number;
  private readonly poolKey?: string | (() => string | undefined);
  private messaging?: MessagingConnection;
  private readonly fujinSelfTarget = `storage-client-${process.pid}-${(fujinClientSeq++).toString(36)}`;

  /**
   * Connect to storage.
   *
   * @param config  - Unix socket path string (legacy) OR a {@link StorageConnectionConfig}.
   * @param options - Optional timeout settings.
   *
   * @example Unix socket (legacy string form):
   *   new StorageConnection("/run/storage.sock")
   *
   * @example Unix socket (config form):
   *   new StorageConnection({ kind: "unix", socketPath: "/run/storage.sock" })
   *
   * @example TCP (direct storage socket):
   *   new StorageConnection({ kind: "tcp", host: "127.0.0.1", port: 9000 })
   *
   * @example fujin (production storage transport — behemoth is a fujin peer):
   *   new StorageConnection({ kind: "fujin", host: "127.0.0.1", port: 5557 })
   */
  constructor(config: string | StorageConnectionConfig, options?: StorageConnectionOptions) {
    this.config = typeof config === "string" ? { kind: "unix", socketPath: config } : config;
    this.socketPath =
      this.config.kind === "unix"
        ? this.config.socketPath
        : this.config.kind === "tcp" || this.config.kind === "fujin"
          ? `${this.config.host}:${this.config.port}`
          : this.config.label ?? "storage-pool";
    this.operationTimeoutMs = options?.operationTimeoutMs;
    this.reconnectAttempts = normalizeNonNegativeInt(
      options?.reconnectAttempts,
      normalizeNonNegativeInt(process.env.TRANSPORT_RECONNECT_ATTEMPTS, 1),
    );
    if (this.config.kind === "pool") {
      this.poolKey = this.config.key;
    } else if (this.config.kind === "fujin") {
      this.connectFujin();
    } else {
      this.connect();
    }
  }

  // One Fujin target belongs to one DEALER connection. A storage client needs
  // its own reply target, so it owns its socket instead of adding an alias to
  // an application runtime's connection.
  private connectFujin(): void {
    if (this.config.kind !== "fujin") return;
    try {
      this.messaging = new MessagingConnection({
        endpoint: `tcp://${this.config.host}:${this.config.port}`,
        maxEnvelopeBytes: 64 * 1024,
        maxPayloadBytes: 16 * 1024 * 1024,
        recvTimeoutMs: 1000,
        sendTimeoutMs: 5000,
      });
    } catch (cause) {
      throw new StorageTransportError(
        "CONNECT_EXCEPTION",
        `fujin messaging connect failed (socket: ${this.socketPath})`,
        { socketPath: this.socketPath, cause },
      );
    }
    this.messaging.declareTarget(this.fujinSelfTarget);
  }

  private connect(): void {
    if (this.config.kind === "pool") return;
    if (this.config.kind === "unix") {
      const socketPath = this.config.socketPath;
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
    } else {
      const hostBuf = Buffer.from(this.config.host + "\0");
      let fd: number;
      try {
        fd = s.transport_connect_tcp(ptr(hostBuf), this.config.port) as number;
      } catch (cause) {
        throw new StorageTransportError(
          "CONNECT_EXCEPTION",
          `transport_connect_tcp threw an exception for ${this.socketPath}`,
          { socketPath: this.socketPath, cause },
        );
      }
      if (fd < 0) {
        throw new StorageTransportError(
          "CONNECT_FAILED",
          `transport_connect_tcp failed: ${fd} (${this.socketPath})`,
          { socketPath: this.socketPath },
        );
      }
      this.fd = fd;
    }
    this.applyOperationTimeout();
  }

  private applyOperationTimeout(): void {
    if (this.operationTimeoutMs === undefined) return;
    let rc: number;
    try {
      rc = s.transport_set_timeout_ms(this.fd, this.operationTimeoutMs >>> 0) as number;
    } catch (cause) {
      this.close();
      throw new StorageTransportError(
        "SET_TIMEOUT_EXCEPTION",
        `transport_set_timeout_ms threw an exception (${this.socketPath})`,
        { socketPath: this.socketPath, cause },
      );
    }
    if (rc !== 0) {
      this.close();
      throw new StorageTransportError(
        "SET_TIMEOUT_FAILED",
        `transport_set_timeout_ms failed: ${rc} (${this.socketPath})`,
        { socketPath: this.socketPath },
      );
    }
  }

  private ensureConnected(): void {
    if (this.config.kind === "pool") return;
    if (this.config.kind === "fujin") {
      if (!this.messaging) this.connectFujin();
      return;
    }
    if (this.fd >= 0) return;
    this.connect();
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
    if (this.config.kind === "pool") return;
    if (this.config.kind === "fujin") {
      const messaging = this.messaging;
      this.messaging = undefined;
      try {
        messaging?.close();
      } catch {}
      return;
    }
    if (this.fd >= 0) {
      const fd = this.fd;
      this.fd = -1;
      try {
        s.transport_close(fd);
      } catch {}
    }
  }

  private reconnectBestEffort(): void {
    try {
      this.ensureConnected();
    } catch {}
  }

  // ── Internal send/recv ───────────────────────────────────────────────────

  private sendRecv(makeReq: () => number): Response {
    if (this.config.kind === "pool") {
      return this.config.pool.request(this.resolvePoolKey(), makeReq, this.socketPath);
    }
    if (this.config.kind === "fujin") {
      return this.sendRecvFujin(makeReq);
    }

    for (let attempt = 0; attempt <= this.reconnectAttempts; attempt++) {
      this.ensureConnected();

      const req = makeReq();
      if (!req) {
        throw new StorageTransportError(
          "SEND_FAILED",
          `failed to build transport request (socket: ${this.socketPath})`,
          { socketPath: this.socketPath },
        );
      }

      let sendRc: number;
      let sendCause: unknown = null;
      try {
        sendRc = s.transport_send_req(this.fd, req) as number;
      } catch (cause) {
        sendRc = -1;
        sendCause = cause;
      } finally {
        if (ENABLE_REQ_FREE) {
          try {
            s.transport_req_free(req);
          } catch {}
        }
      }

      if (sendCause !== null || sendRc !== 0) {
        this.close();
        if (attempt < this.reconnectAttempts) {
          this.ensureConnected();
          continue;
        }

        if (sendCause !== null) {
          throw new StorageTransportError(
            "SEND_EXCEPTION",
            `transport_send_req threw an exception (socket: ${this.socketPath})`,
            { socketPath: this.socketPath, cause: sendCause },
          );
        }

        throw new StorageTransportError(
          "SEND_FAILED",
          `transport_send_req failed: ${sendRc} (timeout or socket error, socket: ${this.socketPath})`,
          { socketPath: this.socketPath },
        );
      }

      let resp: number;
      try {
        resp = s.transport_recv_resp(this.fd) as number;
      } catch (cause) {
        this.close();
        this.reconnectBestEffort();
        throw new StorageTransportError(
          "RECV_EXCEPTION",
          `transport_recv_resp threw an exception (socket: ${this.socketPath})`,
          { socketPath: this.socketPath, cause },
        );
      }
      if (!resp) {
        this.close();
        this.reconnectBestEffort();
        throw new StorageTransportError(
          "RECV_TIMEOUT_OR_CLOSED",
          `transport timeout while waiting for response (or socket closed): ${this.socketPath}`,
          { socketPath: this.socketPath },
        );
      }
      return new Response(resp, this.socketPath);
    }

    throw new StorageTransportError(
      "SEND_FAILED",
      `transport_send_req exhausted reconnect attempts (socket: ${this.socketPath})`,
      { socketPath: this.socketPath },
    );
  }

  // behemoth is a fujin DEALER peer, not a listener — there is no socket to
  // bind to directly. Every storage op is a request/response round trip over
  // the same messaging channel nrpc clients use, addressed to the well-known
  // "behemoth"/"storage" peer, carrying the same Cap'n Proto wire payload the
  // direct-socket path builds. Synchronous by design (blocking recv loop) so
  // engines above (kv/sql/files/...) don't need to become async.
  private sendRecvFujin(makeReq: () => number): Response {
    if (this.config.kind !== "fujin") {
      throw new StorageTransportError("SEND_FAILED", "sendRecvFujin called on a non-fujin connection");
    }
    const cfg = this.config;
    this.ensureConnected();
    const conn = this.messaging;
    if (!conn) {
      throw new StorageTransportError(
        "NOT_CONNECTED",
        `fujin messaging connection is not open (socket: ${this.socketPath})`,
        { socketPath: this.socketPath },
      );
    }

    const req = makeReq();
    if (!req) {
      throw new StorageTransportError(
        "SEND_FAILED",
        `failed to build transport request (socket: ${this.socketPath})`,
        { socketPath: this.socketPath },
      );
    }
    let payload: Uint8Array;
    try {
      payload = encodeReqBytes(req);
    } finally {
      if (ENABLE_REQ_FREE) {
        try {
          s.transport_req_free(req as any);
        } catch {}
      }
    }

    const requestId = crypto.randomUUID();
    const deadlineMs = this.operationTimeoutMs ?? FUJIN_REQUEST_TIMEOUT_MS;
    try {
      conn.send(
        {
          kind: MessageKind.request,
          requestId,
          to: { target: cfg.target ?? FUJIN_STORAGE_TARGET, service: cfg.service ?? FUJIN_STORAGE_SERVICE },
          from: { target: this.fujinSelfTarget },
          method: "storage",
          codec: PayloadCodec.capnp,
          deadlineMs,
        },
        payload,
      );
    } catch (cause) {
      throw new StorageTransportError(
        "SEND_EXCEPTION",
        `fujin messaging send failed (socket: ${this.socketPath})`,
        { socketPath: this.socketPath, cause },
      );
    }

    const deadlineAt = Date.now() + deadlineMs;
    while (Date.now() < deadlineAt) {
      let msg: IncomingMessage | null;
      try {
        msg = conn.recv();
      } catch (cause) {
        throw new StorageTransportError(
          "RECV_EXCEPTION",
          `fujin messaging recv failed (socket: ${this.socketPath})`,
          { socketPath: this.socketPath, cause },
        );
      }
      if (!msg) continue;

      if (msg.envelope.requestId !== requestId) continue;

      if (msg.envelope.kind === MessageKind.error) {
        const errText = decodeErrorPayload(msg.payload);
        throw remoteStorageError(
          errText || msg.envelope.errorCode || "unknown error",
          this.socketPath,
        );
      }

      const respPtr = decodeRespBytes(msg.payload);
      if (!respPtr) {
        throw new StorageTransportError(
          "RECV_TIMEOUT_OR_CLOSED",
          `failed to decode storage response (socket: ${this.socketPath})`,
          { socketPath: this.socketPath },
        );
      }
      return new Response(respPtr, this.socketPath);
    }

    throw new StorageTransportError(
      "RECV_TIMEOUT_OR_CLOSED",
      `fujin messaging request timed out after ${deadlineMs}ms (socket: ${this.socketPath})`,
      { socketPath: this.socketPath },
    );
  }

  private resolvePoolKey(): string | undefined {
    if (typeof this.poolKey === "function") return this.poolKey();
    return this.poolKey;
  }

  // ── Store management ─────────────────────────────────────────────────────

  create(ms: string, store: string, storeType: StoreTypeKey): Telemetry {
    return this.sendRecv(() => s.transport_req_create(cstr(ms), cstr(store), StoreType[storeType]) as number).telemetry();
  }

  open(ms: string, store: string): Telemetry {
    return this.sendRecv(() => s.transport_req_open(cstr(ms), cstr(store)) as number).telemetry();
  }

  close_store(ms: string, store: string): Telemetry {
    return this.sendRecv(() => s.transport_req_close(cstr(ms), cstr(store)) as number).telemetry();
  }

  getSize(ms: string, store: string): bigint {
    const resp = this.sendRecv(() => s.transport_req_size(cstr(ms), cstr(store)) as number);
    return resp.size();
  }

  getStats(ms: string, store: string): StoreStats {
    const resp = this.sendRecv(() => s.transport_req_store_stats(cstr(ms), cstr(store)) as number);
    return resp.storeStats();
  }

  getManifest(ms: string, store: string): ManifestInfo {
    const resp = this.sendRecv(() => s.transport_req_manifest(cstr(ms), cstr(store)) as number);
    return resp.manifest();
  }

  recordMigration(ms: string, store: string, migrationId: string): Telemetry {
    return this.sendRecv(() => s.transport_req_migrate(cstr(ms), cstr(store), cstr(migrationId)) as number).telemetry();
  }

  createArchive(ms: string, store: string, outputPath: string): Telemetry {
    return this.sendRecv(() => s.transport_req_archive(cstr(ms), cstr(store), cstr(outputPath)) as number).telemetry();
  }

  // ── SQL / Column ─────────────────────────────────────────────────────────

  execSql(ms: string, store: string, sql: string): { rowsAffected: bigint; telemetry: Telemetry } {
    const resp = this.sendRecv(() => s.transport_req_exec_sql(cstr(ms), cstr(store), cstr(sql)) as number);
    return { rowsAffected: resp.affected(), telemetry: resp.telemetry() };
  }

  querySql(ms: string, store: string, sql: string): Row[] {
    const resp = this.sendRecv(() => s.transport_req_query_sql(cstr(ms), cstr(store), cstr(sql)) as number);
    return resp.rows();
  }

  // ── KV ───────────────────────────────────────────────────────────────────

  kvPut(ms: string, store: string, key: string, value: Buffer): Telemetry {
    return this.sendRecv(
      () => s.transport_req_kv_put(cstr(ms), cstr(store), cstr(key), ptr(value), BigInt(value.length)) as number,
    ).telemetry();
  }

  kvPutFromCache(ms: string, store: string, key: string, cacheKey: string): Telemetry {
    return this.sendRecv(
      () => s.transport_req_kv_put_from_cache(cstr(ms), cstr(store), cstr(key), cstr(cacheKey)) as number,
    ).telemetry();
  }

  kvGet(ms: string, store: string, key: string): Buffer | null {
    const resp = this.sendRecv(() => s.transport_req_kv_get(cstr(ms), cstr(store), cstr(key)) as number);
    return resp.foundData();
  }

  kvGetToCache(ms: string, store: string, key: string): string | null {
    const resp = this.sendRecv(() => s.transport_req_kv_get_to_cache(cstr(ms), cstr(store), cstr(key)) as number);
    const cacheKey = resp.foundData();
    return cacheKey ? cacheKey.toString("utf8") : null;
  }

  kvDelete(ms: string, store: string, key: string): boolean {
    const resp = this.sendRecv(() => s.transport_req_kv_delete(cstr(ms), cstr(store), cstr(key)) as number);
    return resp.found();
  }

  kvList(ms: string, store: string, prefix = ""): string[] {
    const resp = this.sendRecv(() => s.transport_req_kv_list(cstr(ms), cstr(store), cstr(prefix)) as number);
    return resp.pairs().map(p => p.key);
  }

  kvGetRange(ms: string, store: string, prefix = ""): Buffer[] {
    const resp = this.sendRecv(() => s.transport_req_kv_list(cstr(ms), cstr(store), cstr(prefix)) as number);
    return resp.pairs().map(p => p.value);
  }

  kvCompact(ms: string, store: string): Telemetry {
    return this.sendRecv(() => s.transport_req_kv_compact(cstr(ms), cstr(store)) as number).telemetry();
  }

  // ── Dumps ────────────────────────────────────────────────────────────────

  dumpCreate(ms: string, store: string): string {
    const buf = this.sendRecv(() => s.transport_req_dump_create(cstr(ms), cstr(store)) as number).rawData();
    return buf.toString('utf8');
  }

  dumpList(): Array<{ name: string; size: bigint }> {
    return this.sendRecv(() => s.transport_req_dump_list() as number)
      .pairs()
      .map(p => ({
        name: p.key,
        size: p.value.length >= 8 ? p.value.readBigUInt64LE(0) : 0n,
      }));
  }

  dumpDelete(fileName: string): void {
    this.sendRecv(() => s.transport_req_dump_delete(cstr(fileName)) as number).telemetry();
  }

  dumpRead(fileName: string, offset: bigint, length: number): Buffer {
    return this.sendRecv(
      () => s.transport_req_dump_read(cstr(fileName), offset, length) as number,
    ).rawData();
  }

  // ── Files ────────────────────────────────────────────────────────────────

  filePut(ms: string, store: string, key: string, data: Buffer): Telemetry {
    return this.sendRecv(
      () => s.transport_req_file_put(cstr(ms), cstr(store), cstr(key), ptr(data), BigInt(data.length)) as number,
    ).telemetry();
  }

  fileGetToCache(ms: string, store: string, key: string): string | null {
    const resp = this.sendRecv(() => s.transport_req_file_get_to_cache(cstr(ms), cstr(store), cstr(key)) as number);
    const cacheKey = resp.foundData();
    return cacheKey ? cacheKey.toString("utf8") : null;
  }

  fileDelete(ms: string, store: string, key: string): boolean {
    const resp = this.sendRecv(() => s.transport_req_file_delete(cstr(ms), cstr(store), cstr(key)) as number);
    return resp.found();
  }

  fileList(ms: string, store: string): string[] {
    const resp = this.sendRecv(() => s.transport_req_file_list(cstr(ms), cstr(store)) as number);
    return resp.keys();
  }

  /** Returns all open store keys in "ms/store" format. */
  listStores(): string[] {
    const resp = this.sendRecv(() => s.transport_req_file_list(cstr(""), cstr("")) as number);
    return resp.keys();
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  ping(): void {
    this.sendRecv(() => s.transport_req_ping() as number);
  }

  shutdown(): void {
    this.sendRecv(() => s.transport_req_shutdown() as number);
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
      const err = readCStr(s.transport_resp_error(handle));
      this.free();
      throw remoteStorageError(err, socketPath);
    }
  }

  private free(): void {
    if (!ENABLE_RESP_FREE || this.handle === 0) return;
    try {
      s.transport_resp_free(this.handle);
    } catch {}
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

  storeStats(): StoreStats {
    const cacheBytes = s.transport_resp_stats_cache_bytes(this.handle) as bigint;
    const diskBytes  = s.transport_resp_stats_disk_bytes(this.handle) as bigint;
    this.free();
    return { cacheBytes, diskBytes };
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

  rawData(): Buffer {
    const dataLen = Number(s.transport_resp_data_len(this.handle) as bigint);
    const dataPtr = Number(s.transport_resp_data_ptr(this.handle) as bigint);
    const buf = Buffer.allocUnsafe(dataLen);
    for (let i = 0; i < dataLen; i++) buf[i] = read.u8(dataPtr, i);
    this.free();
    return buf;
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

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.trunc(parsed);
}

function normalizeConnectionConfig(config: string | StorageConnectionTargetConfig): StorageConnectionTargetConfig {
  return typeof config === "string" ? { kind: "unix", socketPath: config } : config;
}

function connectionLabel(config: StorageConnectionTargetConfig): string {
  return config.kind === "unix" ? config.socketPath : `${config.host}:${config.port}`;
}

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
