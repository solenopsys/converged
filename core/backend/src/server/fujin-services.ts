// Lazily builds the ONE messaging connection back-core's microservices share
// to register one `services` target with Fujin, in addition to the HTTP routes
// createHttpBackend already sets up (see createServer.ts, which threads this
// runtime into every plugin's PluginOptions.messagingRuntime — http-backend.ts
// itself calls createMessagingBackend so this file never has to import
// anything nrpc-internal beyond the runtime class + type). Mirrors
// front-core's nrpc/cluster.ts getRuntime() (same lazy-singleton, env-driven
// shape), but on the SERVER side: this process dispatches by `to.service`
// instead of only making them.
// FUJIN_ZMQ_ENDPOINT is optional here (front-core's client-side runtime
// requires it) — standalone/test contexts must keep working HTTP-only, so a
// missing endpoint just skips messaging registration, logged once.
import {
	type CrullerTransportClientConfig,
	NrpcMessagingRuntime,
} from "nrpc/cluster";
import { getCurrentStorageScope } from "../request-context";

const GLOBAL_RUNTIME_KEY = "__CONVERGED_MS_MESSAGING_RUNTIME__";

type RuntimeGlobal = typeof globalThis & {
	[GLOBAL_RUNTIME_KEY]?: NrpcMessagingRuntime;
};
let warnedMissingEndpoint = false;

function positiveEnvironment(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return value;
}

export function getMsMessagingRuntime(): NrpcMessagingRuntime | undefined {
	const runtimeGlobal = globalThis as RuntimeGlobal;
	if (runtimeGlobal[GLOBAL_RUNTIME_KEY]) return runtimeGlobal[GLOBAL_RUNTIME_KEY];
	const endpoint = process.env.FUJIN_ZMQ_ENDPOINT?.trim();
	if (!endpoint) {
		if (!warnedMissingEndpoint) {
			warnedMissingEndpoint = true;
			console.log(
				"[back-core] FUJIN_ZMQ_ENDPOINT not set — microservices stay HTTP-only, no fujin registration",
			);
		}
		return undefined;
	}
	const runtime = new NrpcMessagingRuntime({
		connection: {
			endpoint,
			maxEnvelopeBytes: positiveEnvironment("FUJIN_MAX_ENVELOPE_BYTES", 64 * 1024),
			maxPayloadBytes: positiveEnvironment("FUJIN_MAX_PAYLOAD_BYTES", 16 * 1024 * 1024),
			recvTimeoutMs: positiveEnvironment("FUJIN_RECV_TIMEOUT_MS", 25),
			sendTimeoutMs: positiveEnvironment("FUJIN_SEND_TIMEOUT_MS", 5_000),
		},
		target: process.env.FUJIN_TARGET?.trim() || "services",
		pollIntervalMs: positiveEnvironment("FUJIN_POLL_INTERVAL_MS", 10),
		maxMessagesPerPoll: positiveEnvironment("FUJIN_MAX_MESSAGES_PER_POLL", 128),
	});
	// Server plugins are separate bundles, so a module-local singleton creates
	// one ZMQ identity per bundle. Publish the owner process-wide before plugin
	// construction; createServer starts it only after every handler is attached.
	runtimeGlobal[GLOBAL_RUNTIME_KEY] = runtime;
	return runtime;
}

/**
 * Server-to-service calls always use Fujin's ZMQ NRPC transport — the UI auth
 * gateway and every microservice-to-microservice call go through here instead
 * of an HTTP services port. Requests carry the process SERVICE_TOKEN, which is
 * what `internal` methods (all of ms-auth's session flows) require.
 *
 * `target` is the destination connection target; service selection happens in
 * that process from `Envelope.to.service`.
 */
export function createServerNrpcClientConfig(): CrullerTransportClientConfig {
	const messagingRuntime = getMsMessagingRuntime();
	if (!messagingRuntime) {
		throw new Error("FUJIN_ZMQ_ENDPOINT is required for server NRPC clients");
	}
	const serviceToken = process.env.SERVICE_TOKEN?.trim();
	if (!serviceToken) {
		throw new Error("SERVICE_TOKEN is required for server NRPC clients");
	}
	return {
		runtime: messagingRuntime,
		target: process.env.FUJIN_BACKEND_TARGET?.trim() || "services",
		deadlineMs: positiveEnvironment("FUJIN_NRPC_DEADLINE_MS", 20_000),
		scope: () => getCurrentStorageScope() ?? process.env.STORAGE_SCOPE?.trim(),
		// UI gateway calls are always service-to-service. Do not inherit a
		// browser JWT from an ambient request context.
		auth: serviceToken,
	};
}
