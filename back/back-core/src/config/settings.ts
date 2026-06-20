// Central settings controller — the ONLY place process.env is read.
//
// Rules (production infrastructure has no fallbacks):
//  - No default values. A required setting that is absent throws.
//  - Aliases are not chains of "or" — each setting has exactly one env name.
//  - Values derived from required inputs (e.g. storage host = prefix + scope)
//    are fine; silent literal fallbacks (|| "127.0.0.1") are not.
//  - Every container validates its checklist at startup via assertSettings();
//    if anything required is missing/invalid, the container crashes early.

export class SettingsError extends Error {}

function raw(name: string): string | undefined {
	const value = process.env[name];
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function requireRaw(name: string): string {
	const value = raw(name);
	if (value === undefined) {
		throw new SettingsError(`Missing required env ${name}`);
	}
	return value;
}

function requireInt(name: string): number {
	const value = requireRaw(name);
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) {
		throw new SettingsError(`Env ${name} must be an integer, got "${value}"`);
	}
	return parsed;
}

function optionalInt(name: string): number | undefined {
	const value = raw(name);
	if (value === undefined) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) {
		throw new SettingsError(`Env ${name} must be an integer, got "${value}"`);
	}
	return parsed;
}

function requireEnum<T extends string>(name: string, allowed: readonly T[]): T {
	const value = requireRaw(name);
	if (!(allowed as readonly string[]).includes(value)) {
		throw new SettingsError(
			`Env ${name} must be one of [${allowed.join(", ")}], got "${value}"`,
		);
	}
	return value as T;
}

function requireJsonRecord(name: string): Record<string, string> {
	const value = requireRaw(name);
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new SettingsError(`Env ${name} must be valid JSON`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new SettingsError(`Env ${name} must be a JSON object`);
	}
	return parsed as Record<string, string>;
}

function optionalJsonRecord<T>(name: string): T | undefined {
	const value = raw(name);
	if (value === undefined) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new SettingsError(`Env ${name} must be valid JSON`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new SettingsError(`Env ${name} must be a JSON object`);
	}
	return parsed as T;
}

export const settings = {
	core: {
		accessJwtSecret: () => requireRaw("ACCESS_JWT_SECRET"),
		servicesBase: () => requireRaw("SERVICES_BASE").replace(/\/+$/, ""),
		// Set programmatically by the container entry after boot, not by deploy.
		serviceToken: () => raw("SERVICE_TOKEN"),
		port: () => requireInt("PORT"),
		dataDir: () => requireRaw("DATA_DIR"),
	},
	storage: {
		transport: () => requireEnum("STORAGE_TRANSPORT", ["tcp", "unix"] as const),
		port: () => requireInt("STORAGE_PORT"),
		// Exactly one host source is configured per deployment:
		//  - cloud:  STORAGE_SERVICE_PREFIX → host = `${prefix}-${scope}`
		//  - single: STORAGE_HOST           → fixed host
		servicePrefix: () => raw("STORAGE_SERVICE_PREFIX"),
		host: () => raw("STORAGE_HOST"),
		socketPath: () => raw("STORAGE_SOCKET_PATH"),
		explicitScope: () => raw("STORAGE_SCOPE"),
		tenantServices: <T>() => optionalJsonRecord<T>("STORAGE_TENANT_SERVICES"),
	},
	cache: {
		valkeyPort: () => requireInt("STORAGE_VALKEY_PORT"),
		valkeyDatabase: () => requireInt("STORAGE_VALKEY_DATABASE"),
	},
	scope: {
		workspaceDomainMap: () => requireJsonRecord("WORKSPACE_DOMAIN_MAP"),
		workspaceDomainMapOptional: () =>
			optionalJsonRecord<Record<string, string>>("WORKSPACE_DOMAIN_MAP"),
	},
};

// Full registry of env settings — the source of truth for the startup dump.
// `secret` values are masked in the log (never print credentials in clear).
interface SettingDescriptor {
	name: string;
	secret?: boolean;
}

export const SETTINGS_REGISTRY: SettingDescriptor[] = [
	// core / runtime
	{ name: "APP_NAME" },
	{ name: "NODE_ENV" },
	{ name: "PORT" },
	{ name: "DATA_DIR" },
	{ name: "CONFIG_PATH" },
	{ name: "PROJECT_DIR" },
	{ name: "APP_ROOT" },
	{ name: "RUNTIME_MAP_PATH" },
	{ name: "BIN_LIBS_PATH" },
	{ name: "SERVICES_BASE" },
	{ name: "RT_RUNTIMES" },
	{ name: "RUNTIMES" },
	{ name: "IMAGE_CACHE_CONTROL" },
	{ name: "ACCESS_JWT_SECRET", secret: true },
	{ name: "SERVICE_TOKEN", secret: true },
	// storage
	{ name: "STORAGE_TRANSPORT" },
	{ name: "STORAGE_PORT" },
	{ name: "STORAGE_SERVICE_PREFIX" },
	{ name: "STORAGE_HOST" },
	{ name: "STORAGE_SOCKET_PATH" },
	{ name: "STORAGE_SCOPE" },
	{ name: "STORAGE_TENANT" },
	{ name: "STORAGE_TENANT_SERVICES" },
	// cache (valkey)
	{ name: "STORAGE_VALKEY_PORT" },
	{ name: "STORAGE_VALKEY_DATABASE" },
	// scope routing
	{ name: "WORKSPACE_DOMAIN_MAP" },
	// ai providers
	{ name: "OPENAI_API_KEY", secret: true },
	{ name: "OPENAI_MODEL" },
	{ name: "CLAUDE_API_KEY", secret: true },
	{ name: "CLAUDE_MODEL" },
	{ name: "GEMINI_API_KEY", secret: true },
	{ name: "GEMINI_MODEL" },
	{ name: "GOOGLE_API_KEY", secret: true },
	{ name: "GOOGLE_CX" },
];

function maskSecret(value: string): string {
	if (value.length <= 8) return `*** (len=${value.length})`;
	return `${value.slice(0, 4)}…${value.slice(-2)} (len=${value.length})`;
}

// Print every known setting at container startup, regardless of role (UI/MS/RT).
// Required-but-missing values show "(NOT SET)" so misconfiguration is obvious.
export function printSettings(
	label: string,
	log: (message: string) => void = console.log,
): void {
	log(`[settings] ${label}: effective configuration`);
	for (const descriptor of SETTINGS_REGISTRY) {
		const value = raw(descriptor.name);
		const printed =
			value === undefined
				? "(NOT SET)"
				: descriptor.secret
					? maskSecret(value)
					: value;
		log(`[settings]   ${descriptor.name} = ${printed}`);
	}
}

// Run a checklist of setting accessors at container startup. Every accessor that
// throws (missing/invalid) is collected, and one aggregated error is raised so
// the container crashes with the full list of what is misconfigured.
export function assertSettings(checklist: Array<() => unknown>): void {
	const errors: string[] = [];
	for (const check of checklist) {
		try {
			check();
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}
	if (errors.length > 0) {
		throw new SettingsError(
			`Container misconfigured — ${errors.length} setting(s) invalid:\n  - ${errors.join(
				"\n  - ",
			)}`,
		);
	}
}

// Startup checklist for any container that talks to scoped cloud storage + cache
// (UI runtime, services, runtimes). These must all be present or the pod dies.
export const CLOUD_STORAGE_CHECKLIST: Array<() => unknown> = [
	settings.core.accessJwtSecret,
	settings.core.servicesBase,
	settings.storage.transport,
	settings.storage.port,
	settings.cache.valkeyPort,
	settings.cache.valkeyDatabase,
	settings.scope.workspaceDomainMap,
	// Exactly one storage host source must be configured.
	() => {
		const prefix = settings.storage.servicePrefix();
		const host = settings.storage.host();
		if (!prefix && !host) {
			throw new SettingsError(
				"One of STORAGE_SERVICE_PREFIX or STORAGE_HOST must be set",
			);
		}
	},
];

export { optionalInt };
