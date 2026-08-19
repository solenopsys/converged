import type { CrullerTransportClientConfig } from "nrpc/cluster";
// Imported by its own path, not from the "back-core" barrel: the barrel
// re-exports ./stores, whose create.ts pulls runtime symbols out of
// "bun-transport". A bundler must evaluate that module, so the UI bundle would
// carry the native storage transport and open storage connections a UI host
// must never have.
import { getMsMessagingRuntime } from "back-core/fujin-services";

// ONE messaging runtime per process. A second one would open a second ZMQ
// DEALER and register under the same FUJIN_TARGET name; fujin keeps a single
// identity per name (last writer wins), so replies addressed to that name land
// on whichever socket registered last. The loser's requests then die of their
// deadline with no error logged anywhere — see the auth-gateway timeout.
export type SsrNrpcClientOptions = {
	target?: string;
	scope?: string;
	deadlineMs?: number;
};

const DEFAULT_BACKEND_TARGET = "services";
const DEFAULT_DEADLINE_MS = 20_000;

function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required for SSR cluster transport`);
	return value;
}

function positiveEnvironment(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return value;
}

function getRuntime() {
	// back-core owns the process-wide runtime; it returns undefined only when
	// FUJIN_ZMQ_ENDPOINT is unset, which SSR cannot work without.
	requiredEnvironment("FUJIN_ZMQ_ENDPOINT");
	const runtime = getMsMessagingRuntime();
	if (!runtime) {
		throw new Error("FUJIN_ZMQ_ENDPOINT is required for SSR cluster transport");
	}
	return runtime;
}

export function createSsrNrpcClientConfig(
	options: SsrNrpcClientOptions = {},
): CrullerTransportClientConfig {
	const target = (
		options.target ??
		process.env.FUJIN_BACKEND_TARGET ??
		DEFAULT_BACKEND_TARGET
	).trim();
	if (!target) throw new Error("Fujin SSR target is empty");

	const deadlineMs =
		options.deadlineMs ?? positiveEnvironment("FUJIN_NRPC_DEADLINE_MS", DEFAULT_DEADLINE_MS);

	return {
		runtime: getRuntime(),
		target,
		scope: options.scope,
		// SSR runs inside the UI host. Its prefetches are server-to-service calls,
		// never browser impersonation, so an ambient request JWT must not leak into
		// their envelopes.
		auth: requiredEnvironment("SERVICE_TOKEN"),
		deadlineMs,
	};
}
