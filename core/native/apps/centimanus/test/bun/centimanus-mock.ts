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
	rt_set_llm_handler: { args: [FFIType.ptr], returns: FFIType.void },
	rt_set_sub_resolver: { args: [FFIType.ptr], returns: FFIType.void },
	rt_set_cache_del: { args: [FFIType.ptr], returns: FFIType.void },
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

/** Answers one `rt.llm(request)` with a uniform completion, e.g.
 *  { provider, model, text, toolCalls: [], finishReason: "stop",
 *    usage: { input: 0, output: 0 } }. Throw to simulate a provider failure. */
export type LlmHandler = (request: any) => unknown;

export interface RunOptions {
	/** Pre-seed the cache (e.g. input file blobs). Defaults to an empty cache. */
	cache?: Cache;
	/** Answers rt.llm calls; without it rt.llm fails (like a hub with no keys). */
	llm?: LlmHandler;
	/** Compiled sources for the workflows `rt.sub` may delegate to, keyed by
	 *  script path. A delegated child runs on this same engine, so a test
	 *  exercises real nesting rather than a stub. */
	workflows?: Record<string, string>;
}

/** Run a compiled workflow source with `params`, routing its calls to `handler`
 *  and its state to a shared cache. */
export function runWorkflow(source: string, params: unknown, handler: CallHandler, opts: RunOptions = {}): WorkflowOutcome {
	s.rt_reset();
	const cache: Cache = opts.cache ?? new Map();

	let handlerError: unknown = null;
	let callReply: Uint8Array | null = null; // hold replies alive across the FFI return
	let getReply: Uint8Array | null = null;
	let llmReply: Uint8Array | null = null;
	let subReply: Uint8Array | null = null;

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
				// 0x01 sentinel: a failed call whose message reaches the workflow,
				// the way a real microservice error would.
				callReply = Buffer.from(
					`\x01${JSON.stringify({ error: messageOf(error) })}\0`,
				);
				return Number(ptr(callReply));
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

	const delCb = new JSCallback(
		(keyPtr: number): void => {
			cache.delete(new CString(keyPtr).toString());
		},
		{ args: [FFIType.ptr], returns: FFIType.void },
	);

	const setCb = new JSCallback(
		(keyPtr: number, valuePtr: number): void => {
			cache.set(new CString(keyPtr).toString(), new CString(valuePtr).toString());
		},
		{ args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
	);

	const llmCb = opts.llm
		? new JSCallback(
				(requestPtr: number): number => {
					try {
						const request = JSON.parse(new CString(requestPtr).toString());
						const result = opts.llm!(request);
						llmReply = Buffer.from(`${JSON.stringify(result ?? null)}\0`);
						return Number(ptr(llmReply));
					} catch (error) {
						handlerError = error;
						// 0x01 sentinel: a failed rt.llm carrying the hub's message.
						llmReply = Buffer.from(`\x01${messageOf(error)}\0`);
						return Number(ptr(llmReply));
					}
				},
				{ args: [FFIType.ptr], returns: FFIType.ptr },
			)
		: null;

	const subWorkflows = opts.workflows;
	const subCb = subWorkflows
		? new JSCallback(
				(scriptPtr: number): number => {
					const script = new CString(scriptPtr).toString();
					const child = subWorkflows[script];
					if (child === undefined) return 0;
					subReply = Buffer.from(`${child}\0`);
					return Number(ptr(subReply));
				},
				{ args: [FFIType.ptr], returns: FFIType.ptr },
			)
		: null;

	try {
		s.rt_set_call_handler(callCb.ptr);
		s.rt_set_cache_handlers(getCb.ptr, setCb.ptr);
		s.rt_set_cache_del(delCb.ptr);
		s.rt_set_llm_handler(llmCb ? llmCb.ptr : null);
		s.rt_set_sub_resolver(subCb ? subCb.ptr : null);

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
		s.rt_set_cache_del(null);
		s.rt_set_llm_handler(null);
		s.rt_set_sub_resolver(null);
		callCb.close();
		getCb.close();
		setCb.close();
		delCb.close();
		llmCb?.close();
		subCb?.close();
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Convenience: run and assert success, returning the workflow result. */
export function runOk(source: string, params: unknown, handler: CallHandler, opts?: RunOptions): any {
	const outcome = runWorkflow(source, params, handler, opts);
	if (!outcome.ok) throw new Error(`workflow failed: ${outcome.error}`);
	return outcome.result;
}
