// Bun harness for the RT VM: load the real engine as a C library and answer its
// microservice calls with in-process TS handlers. A test runs a *compiled*
// workflow on the real step-driven DAG — no sockets, no container.
//
// Build the library first:  zig build mock -Dtarget=x86_64-linux-gnu

import { CString, FFIType, JSCallback, dlopen, ptr } from "bun:ffi";

function libPath(): string {
	if (process.env.RT_MOCK_LIB) return process.env.RT_MOCK_LIB;
	return `${import.meta.dir}/../../zig-out/lib/librt-mock.so`;
}

const lib = dlopen(libPath(), {
	rt_set_call_handler: { args: [FFIType.ptr], returns: FFIType.void },
	rt_set_cache_handlers: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
	rt_run: { args: [FFIType.cstring, FFIType.cstring, FFIType.ptr], returns: FFIType.ptr },
	rt_free: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.void },
	rt_reset: { args: [], returns: FFIType.void },
});
const s = lib.symbols;

/** The Valkey stand-in: a string keyed cache shared by the engine and the mocked
 *  microservices. Handlers exchange blobs by reference through it (CacheRef). */
export type Cache = Map<string, string>;

/** Answers one `rt.call(service, method, params)`. The shared cache lets a
 *  handler stash a blob and return a ref that a later handler reads back. Throw
 *  to simulate a microservice failure. */
export type CallHandler = (service: string, method: string, params: any, cache: Cache) => unknown;

export type WorkflowOutcome =
	| { ok: true; result: any; cache: Cache }
	| { ok: false; error: string; cache: Cache };

export interface RunOptions {
	/** Pre-seed the cache (e.g. input file blobs). Defaults to an empty cache. */
	cache?: Cache;
}

/** Run a compiled workflow source with `params`, routing its calls to `handler`
 *  and its state to a shared cache. */
export function runWorkflow(source: string, params: unknown, handler: CallHandler, opts: RunOptions = {}): WorkflowOutcome {
	s.rt_reset();
	const cache: Cache = opts.cache ?? new Map();

	let handlerError: unknown = null;
	let callReply: Uint8Array | null = null; // hold replies alive across the FFI return
	let getReply: Uint8Array | null = null;

	const callCb = new JSCallback(
		(servicePtr: number, methodPtr: number, bodyPtr: number): number => {
			try {
				const service = new CString(servicePtr).toString();
				const method = new CString(methodPtr).toString();
				const body = JSON.parse(new CString(bodyPtr).toString());
				const result = handler(service, method, body, cache);
				callReply = Buffer.from(`${JSON.stringify(result ?? null)}\0`);
				return Number(ptr(callReply));
			} catch (error) {
				handlerError = error;
				return 0; // null -> the engine sees a failed call
			}
		},
		{ args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
	);

	const getCb = new JSCallback(
		(keyPtr: number): number => {
			const value = cache.get(new CString(keyPtr).toString());
			if (value === undefined) return 0;
			getReply = Buffer.from(`${value}\0`);
			return Number(ptr(getReply));
		},
		{ args: [FFIType.ptr], returns: FFIType.ptr },
	);

	const setCb = new JSCallback(
		(keyPtr: number, valuePtr: number): void => {
			cache.set(new CString(keyPtr).toString(), new CString(valuePtr).toString());
		},
		{ args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
	);

	try {
		s.rt_set_call_handler(callCb.ptr);
		s.rt_set_cache_handlers(getCb.ptr, setCb.ptr);

		const lenBuf = new BigUint64Array(1);
		const outPtr = s.rt_run(
			Buffer.from(`${source}\0`),
			Buffer.from(`${JSON.stringify(params ?? {})}\0`),
			ptr(lenBuf),
		) as number;
		if (!outPtr) {
			if (handlerError) throw handlerError;
			throw new Error("rt_run returned null");
		}

		const len = Number(lenBuf[0]);
		const json = new CString(outPtr, 0, len).toString();
		s.rt_free(outPtr, BigInt(len));
		return { ...(JSON.parse(json) as Omit<WorkflowOutcome, "cache">), cache } as WorkflowOutcome;
	} finally {
		s.rt_set_call_handler(null);
		s.rt_set_cache_handlers(null, null);
		callCb.close();
		getCb.close();
		setCb.close();
	}
}

/** Convenience: run and assert success, returning the workflow result. */
export function runOk(source: string, params: unknown, handler: CallHandler, opts?: RunOptions): any {
	const outcome = runWorkflow(source, params, handler, opts);
	if (!outcome.ok) throw new Error(`workflow failed: ${outcome.error}`);
	return outcome.result;
}
