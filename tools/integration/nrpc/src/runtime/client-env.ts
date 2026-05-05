export const NRPC_FORWARDED_HOST_HEADER = "x-forwarded-host";

export interface NrpcClientEnv {
	headers?: Record<string, string | undefined>;
}

declare global {
	var __NRPC_CLIENT_ENV__: NrpcClientEnv | undefined;
}

function normalize(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized || undefined;
}

export function configureNrpcClientEnv(env: NrpcClientEnv): void {
	globalThis.__NRPC_CLIENT_ENV__ = {
		...globalThis.__NRPC_CLIENT_ENV__,
		...env,
		headers: {
			...globalThis.__NRPC_CLIENT_ENV__?.headers,
			...env.headers,
		},
	};
}

export function getNrpcClientEnv(): NrpcClientEnv {
	return globalThis.__NRPC_CLIENT_ENV__ ?? {};
}

export function getNrpcClientHeaders(): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(getNrpcClientEnv().headers ?? {})) {
		const normalized = normalize(value);
		if (normalized) result[key] = normalized;
	}
	return result;
}
