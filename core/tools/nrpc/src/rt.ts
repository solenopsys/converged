// RT VM entrypoint — only what a QuickJS workflow bundle may pull in.
// No fetch, no node/bun builtins, no cluster transport: the generated g-*/rt
// clients and dag-core redirect bare `nrpc` here when bundling workflows.

export { createRtClient } from "./runtime/rt-client";
export type {
	MethodMetadata,
	ParameterMetadata,
	ServiceMetadata,
	TypeMetadata,
} from "./types";
