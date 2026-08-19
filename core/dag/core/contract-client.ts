// contractClient — a typed rt-transport client for services whose ref-based
// methods are not in the shared nrpc interfaces yet (or whose g-* package is
// not generated at all). It uses the REAL nrpc rt-client with inline metadata,
// so positional-args → named-params mapping and serialization behave exactly
// as the generated `g-*/rt` clients; once the interface lands in
// tools/types/services and codegen runs, switching a workflow to the generated
// client is a drop-in import change.

import { createRtClient, type ServiceMetadata } from "nrpc";


export type ContractSpec<T> = { [K in keyof T]: string[] };

export function contractClient<T>(serviceName: string, methods: ContractSpec<T>): T {
	const metadata: ServiceMetadata = {
		serviceName,
		interfaceName: serviceName,
		filePath: "",
		types: [],
		methods: (Object.entries(methods) as [string, string[]][]).map(([name, params]) => ({
			name,
			parameters: params.map((p) => ({ name: p, type: "any", optional: true, isArray: false })),
			returnType: "any",
			isAsync: false,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		})),
	};
	return createRtClient<T>(metadata);
}
