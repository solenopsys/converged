import { resolve } from "node:path";
import {
	createBunRedisCache,
	createRuntimeImagesPlugin,
	createServer,
	loadConfigFromEnv,
} from "back-core/server";
import type { ServerPlugin } from "back-core/server-app";
import { authGatewayPlugin } from "front-core/auth-gateway";

export interface LandingDevServerOptions {
	name: string;
	projectDir: string;
	spa: ServerPlugin;
	landing: ServerPlugin;
}

export function requiredLandingEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`[landing-dev] missing required env ${name}`);
	return value;
}

function requiredPositiveNumber(name: string): number {
	const raw = requiredLandingEnv(name);
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`[landing-dev] ${name} must be a positive number, received ${JSON.stringify(raw)}`);
	}
	return value;
}

export async function startLandingDevServer(options: LandingDevServerOptions) {
	const runtimeCache = createBunRedisCache({
		url: process.env.VALKEY_URL,
		keyPrefix: requiredLandingEnv("VALKEY_KEY_PREFIX"),
		defaultTtlSeconds: requiredPositiveNumber("VALKEY_TTL_SECONDS"),
	});
	const storageScope = requiredLandingEnv("STORAGE_SCOPE");
	const server = createServer({
		config: {
			...loadConfigFromEnv(),
			name: options.name,
			port: requiredPositiveNumber("PORT"),
			dataDir: requiredLandingEnv("DATA_DIR"),
			extraConfig: {
				cache: runtimeCache,
				valkey: runtimeCache,
			},
		},
		plugins: [authGatewayPlugin],
	});

	server.app
		.use(
			createRuntimeImagesPlugin({
				cache: runtimeCache,
				fallbackScope: storageScope,




				fallbackDir: resolve(import.meta.dir, "..", "public"),
			}),
		)
		.use(options.spa)
		.get("/health", () => ({ status: "ok" }))
		.use(options.landing);

	await server.start();
}
