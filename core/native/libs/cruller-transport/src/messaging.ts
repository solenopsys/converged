import { CString, dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import { join } from "path";

const SYMBOLS = {
	msg_connect: { args: [FFIType.cstring, FFIType.u64, FFIType.u64], returns: FFIType.i32 },
	msg_set_timeout_ms: { args: [FFIType.i32, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
	msg_declare_target: { args: [FFIType.i32, FFIType.cstring], returns: FFIType.i32 },
	msg_send: {
		args: [
			FFIType.i32,
			FFIType.u8,
			FFIType.u16,
			FFIType.u16,
			FFIType.u32,
			FFIType.u8,
			FFIType.u32,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.cstring,
			FFIType.ptr,
			FFIType.u64,
		],
		returns: FFIType.i32,
	},
	msg_recv: { args: [FFIType.i32], returns: FFIType.ptr },
	msg_recv_nowait: { args: [FFIType.i32], returns: FFIType.ptr },
	msg_close: { args: [FFIType.i32], returns: FFIType.void },
	msg_in_version: { args: [FFIType.ptr], returns: FFIType.u8 },
	msg_in_kind: { args: [FFIType.ptr], returns: FFIType.u16 },
	msg_in_codec: { args: [FFIType.ptr], returns: FFIType.u16 },
	msg_in_seq: { args: [FFIType.ptr], returns: FFIType.u32 },
	msg_in_fin: { args: [FFIType.ptr], returns: FFIType.u8 },
	msg_in_deadline_ms: { args: [FFIType.ptr], returns: FFIType.u32 },
	msg_in_request_id: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_to_target: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_to_service: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_from_target: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_from_service: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_method: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_scope: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_user: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_auth: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_error_code: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_payload_ptr: { args: [FFIType.ptr], returns: FFIType.ptr },
	msg_in_payload_len: { args: [FFIType.ptr], returns: FFIType.u64 },
	msg_in_free: { args: [FFIType.ptr], returns: FFIType.void },
} as const;

export const MessageKind = {
	request: 0,
	response: 1,
	error: 2,
	event: 3,
	streamChunk: 4,
} as const;

export type MessageKindValue = (typeof MessageKind)[keyof typeof MessageKind];

export const PayloadCodec = { json: 0, capnp: 1, raw: 2 } as const;
export type PayloadCodecValue = (typeof PayloadCodec)[keyof typeof PayloadCodec];

export interface MessageAddress {
	target: string;
	service?: string;
}

export interface MessageEnvelope {
	version?: number;
	kind: MessageKindValue;
	requestId?: string;
	to?: MessageAddress;
	from?: MessageAddress;
	method?: string;
	scope?: string;
	user?: string;
	auth?: string;
	codec?: PayloadCodecValue;
	seq?: number;
	fin?: boolean;
	deadlineMs?: number;
	errorCode?: string;
}

export interface IncomingMessage {
	envelope: Required<Omit<MessageEnvelope, "to" | "from">> & {
		to: Required<MessageAddress>;
		from: Required<MessageAddress>;
	};
	payload: Uint8Array;
}

export interface MessagingConnectionOptions {
	endpoint: string;
	maxEnvelopeBytes: number;
	maxPayloadBytes: number;
	recvTimeoutMs: number;
	sendTimeoutMs: number;
}

export class MessagingTransportError extends Error {
	constructor(
		message: string,
		readonly code: "CONNECT_FAILED" | "CONFIG_FAILED" | "SEND_FAILED",
	) {
		super(message);
		this.name = "MessagingTransportError";
	}
}

function getLibPath(): string {
	const arch = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch;
	const libc = process.env.LIBC_VARIANT || "gnu";
	const filename = `libmessage-${arch}-${libc}.so`;
	const binLibsDir = process.env.BIN_LIBS_PATH;
	return binLibsDir && binLibsDir.length > 0
		? join(binLibsDir, filename)
		: `${import.meta.dir}/../bin-libs/${filename}`;
}

export const MESSAGE_LIBRARY_PATH = getLibPath();
const library = dlopen(MESSAGE_LIBRARY_PATH, SYMBOLS);
const native = library.symbols;

export class MessagingConnection {
	private handle: number;

	constructor(readonly options: MessagingConnectionOptions) {
		assertPositiveInteger("maxEnvelopeBytes", options.maxEnvelopeBytes);
		assertPositiveInteger("maxPayloadBytes", options.maxPayloadBytes);
		assertNonNegativeInteger("recvTimeoutMs", options.recvTimeoutMs);
		assertNonNegativeInteger("sendTimeoutMs", options.sendTimeoutMs);
		if (!options.endpoint.trim()) throw new MessagingTransportError("messaging endpoint is empty", "CONFIG_FAILED");

		this.handle = native.msg_connect(
			cstr(options.endpoint),
			options.maxEnvelopeBytes,
			options.maxPayloadBytes,
		) as number;
		if (this.handle <= 0) {
			throw new MessagingTransportError(`failed to connect to ${options.endpoint}`, "CONNECT_FAILED");
		}
		if (native.msg_set_timeout_ms(this.handle, options.recvTimeoutMs, options.sendTimeoutMs) !== 0) {
			native.msg_close(this.handle);
			this.handle = -1;
			throw new MessagingTransportError("failed to configure messaging timeouts", "CONFIG_FAILED");
		}
	}

	/**
	 * Declares application-owned names. The Zig transport owns registration,
	 * heartbeats, reconnect and every system frame; this method never writes a
	 * protocol control packet from TypeScript.
	 */
	declareTarget(target: string): void {
		this.assertOpen();
		if (native.msg_declare_target(this.handle, cstr(target)) !== 0) {
			throw new MessagingTransportError(`failed to declare messaging target ${target}`, "CONFIG_FAILED");
		}
	}

	send(envelope: MessageEnvelope, payload: Uint8Array = new Uint8Array()): void {
		this.assertOpen();
		const payloadPointer = payload.byteLength > 0 ? ptr(payload) : null;
		const rc = native.msg_send(
			this.handle,
			envelope.version ?? 1,
			envelope.kind,
			envelope.codec ?? PayloadCodec.json,
			envelope.seq ?? 0,
			envelope.fin ? 1 : 0,
			envelope.deadlineMs ?? 0,
			cstr(envelope.requestId ?? ""),
			cstr(envelope.to?.target ?? ""),
			cstr(envelope.to?.service ?? ""),
			cstr(envelope.from?.target ?? ""),
			cstr(envelope.from?.service ?? ""),
			cstr(envelope.method ?? ""),
			cstr(envelope.scope ?? ""),
			cstr(envelope.user ?? ""),
			cstr(envelope.errorCode ?? ""),
			cstr(envelope.auth ?? ""),
			payloadPointer,
			payload.byteLength,
		) as number;
		if (rc !== 0) throw new MessagingTransportError("failed to send messaging packet", "SEND_FAILED");
	}

	recv(): IncomingMessage | null {
		this.assertOpen();
		return this.receiveNative(native.msg_recv(this.handle));
	}

	recvNowait(): IncomingMessage | null {
		this.assertOpen();
		return this.receiveNative(native.msg_recv_nowait(this.handle));
	}

	private receiveNative(message: ReturnType<typeof native.msg_recv>): IncomingMessage | null {
		this.assertOpen();
		if (!message) return null;
		try {
			const payloadLength = Number(native.msg_in_payload_len(message));
			const payloadPointer = native.msg_in_payload_ptr(message);
			const payload = payloadLength === 0
				? new Uint8Array()
				: new Uint8Array(toArrayBuffer(payloadPointer!, 0, payloadLength)).slice();
			return {
				envelope: {
					version: native.msg_in_version(message) as number,
					kind: native.msg_in_kind(message) as MessageKindValue,
					codec: native.msg_in_codec(message) as PayloadCodecValue,
					seq: native.msg_in_seq(message) as number,
					fin: (native.msg_in_fin(message) as number) !== 0,
					deadlineMs: native.msg_in_deadline_ms(message) as number,
					requestId: readCStr(native.msg_in_request_id(message)),
					to: {
						target: readCStr(native.msg_in_to_target(message)),
						service: readCStr(native.msg_in_to_service(message)),
					},
					from: {
						target: readCStr(native.msg_in_from_target(message)),
						service: readCStr(native.msg_in_from_service(message)),
					},
					method: readCStr(native.msg_in_method(message)),
					scope: readCStr(native.msg_in_scope(message)),
					user: readCStr(native.msg_in_user(message)),
					auth: readCStr(native.msg_in_auth(message)),
					errorCode: readCStr(native.msg_in_error_code(message)),
				},
				payload,
			};
		} finally {
			native.msg_in_free(message);
		}
	}

	close(): void {
		if (this.handle < 0) return;
		native.msg_close(this.handle);
		this.handle = -1;
	}

	private assertOpen(): void {
		if (this.handle < 0) throw new MessagingTransportError("messaging connection is closed", "CONFIG_FAILED");
	}
}

function cstr(value: string): Buffer {
	return Buffer.from(`${value}\0`);
}

function readCStr(raw: unknown): string {
	if (raw === null || raw === undefined || raw === 0 || raw === 0n) return "";
	if (typeof raw === "string") return raw;
	return new CString(raw as never).toString();
}

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new MessagingTransportError(`${name} must be a positive integer`, "CONFIG_FAILED");
	}
}

function assertNonNegativeInteger(name: string, value: number): void {
	if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
		throw new MessagingTransportError(`${name} must be a non-negative i32`, "CONFIG_FAILED");
	}
}
