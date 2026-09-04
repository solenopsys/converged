// rt-client.ts — nrpc transport for the RT virtual machine (QuickJS / Zig host).
// Same generated metadata as the HTTP client, but instead of `fetch` each method
// crosses into Zig through `globalThis.rt.call(service, method, params)` — the
// host bridge the RT VM installs (see native/centimanus/src/prelude.js). Calls are
// there is no event loop to await. Business logic stays in the microservice; the
// workflow only sequences these calls.
// This module is intentionally dependency-light (no fetch/Node imports) so bun
// can tree-shake a workflow bundle down to just the methods it actually calls.

import type { ServiceMetadata, ParameterMetadata } from "../types";
import { deserializeValue, serializeValue } from "./serialization";

interface RtHostBridge {
	call(
		service: string,
		method: string,
		params: Record<string, unknown>,
		target?: string,
	): unknown;
}

function hostBridge(): RtHostBridge {
	const rt = (globalThis as Record<string, unknown>).rt as RtHostBridge | undefined;
	if (!rt || typeof rt.call !== "function") {
		throw new Error(
			"nrpc rt-client: globalThis.rt host bridge is not installed — this client only runs inside the RT VM",
		);
	}
	return rt;
}

function prepareParams(paramDefs: ParameterMetadata[], args: unknown[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	paramDefs.forEach((def, index) => {
		if (args[index] !== undefined) {
			result[def.name] = serializeValue(args[index], def.type);
		} else if (!def.optional) {
			throw new Error(`Required parameter '${def.name}' is missing`);
		}
	});
	return result;
}


export function createRtClient<T>(metadata: ServiceMetadata): T {
	const proxy: Record<string, unknown> = {};

	for (const method of metadata.methods) {
		proxy[method.name] = (...args: unknown[]): unknown => {
			if (method.isAsyncIterable) {
				throw new Error(`nrpc rt-client: streaming method ${method.name} is not supported in the RT VM`);
			}
			const params = prepareParams(method.parameters, args);
			// `metadata.target` is the Fujin peer the service lives behind. The ws
			// and zmq clients already honour it; dropping it here is what sent
			// every workflow call to the default `services` peer, so a service
			// that is its own peer — a native processor — was unreachable from a
			// workflow no matter what name it was called by.
			const raw = hostBridge().call(
				metadata.serviceName,
				method.name,
				params,
				metadata.target,
			);
			if (method.returnType === "void") return undefined;
			return deserializeValue(raw, method.returnType);
		};
	}

	return proxy as T;
}
