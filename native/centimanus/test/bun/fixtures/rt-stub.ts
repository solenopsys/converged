// Test stand-ins for the `g-*/rt` packages. They use the REAL nrpc rt-client
// (so positional-args -> named-params mapping and serialization behave exactly
// as generated), with inline metadata that includes the ref-based methods from
// wf-file-analysis/contract.md — without touching the shared service interfaces
// or the microservices that implement them.

import { createRtClient, type ServiceMetadata } from "nrpc";

/** Build a client factory from a compact `{ method: [paramNames] }` spec. */
export function stubClient(serviceName: string, methods: Record<string, string[]>): () => any {
	const metadata: ServiceMetadata = {
		serviceName,
		interfaceName: serviceName,
		filePath: "",
		types: [],
		methods: Object.entries(methods).map(([name, params]) => ({
			name,
			parameters: params.map((p) => ({ name: p, type: "any", optional: false, isArray: false })),
			returnType: "any",
			isAsync: false,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		})),
	};
	return () => createRtClient<any>(metadata);
}
