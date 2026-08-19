// Central settings controller — the ONLY place process.env is read.
// Rules (production infrastructure has no fallbacks):
//    are fine; silent literal fallbacks (|| "127.0.0.1") are not.
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

function requireJsonObject<T>(name: string): T {
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
	return parsed as T;
}

export const settings = {
	core: {
		accessJwtPublicJwks: () => requireJsonObject("ACCESS_JWT_PUBLIC_JWKS"),
		accessJwtIssuer: () => requireRaw("ACCESS_JWT_ISSUER"),
		accessJwtAudience: () => requireRaw("ACCESS_JWT_AUDIENCE"),
		servicesBase: () => requireRaw("SERVICES_BASE").replace(/\/+$/, ""),
		// Set programmatically by the container entry after boot, not by deploy.
		serviceToken: () => raw("SERVICE_TOKEN"),
		port: () => requireInt("PORT"),
		dataDir: () => requireRaw("DATA_DIR"),
	},
	storage: {
		// scope → storage endpoint ({host, port}). The host is named here directly;
		// the scope arrives as an edge-injected request header (or the STORAGE_SCOPE
		// pin) — it is no longer mapped from the Host inside the app.
		tenantServices: <T>() => requireJsonObject<T>("STORAGE_TENANT_SERVICES"),
		// Optional single scope pin (non-HTTP contexts); normally scope is per-request.
		explicitScope: () => raw("STORAGE_SCOPE"),
	},
	cache: {
		// Valkey is co-located with the storage host; only its port is configured.
		valkeyPort: () => requireInt("STORAGE_VALKEY_PORT"),
	},
	demo: {
		// Per-tenant opt-in for the "Admin login" demo auto-session. Absent or any
		// value other than "true" means disabled — fail-closed, so the same image
		// on a real customer tenant never mints a demo token. No default.
		landingDemoMode: () => raw("LANDING_DEMO_MODE") === "true",
	},
	// Magic-link delivery for the UI auth-gateway. The transport is a deployment
	// choice (AWS SES or a plain SMTP relay); credentials belong to whichever one
	// is selected, and are read only when a link is actually sent.
	authMail: {
		transport: (): "ses" | "smtp" => {
			const value = requireRaw("AUTH_MAIL_TRANSPORT").toLowerCase();
			if (value !== "ses" && value !== "smtp") {
				throw new SettingsError(
					`Env AUTH_MAIL_TRANSPORT must be "ses" or "smtp", got "${value}"`,
				);
			}
			return value;
		},
		from: () => requireRaw("AUTH_MAIL_FROM"),
		ses: () => ({
			accessKeyId: requireRaw("AUTH_MAIL_SES_ACCESS_KEY_ID"),
			secretAccessKey: requireRaw("AUTH_MAIL_SES_SECRET_ACCESS_KEY"),
			region: requireRaw("AUTH_MAIL_SES_REGION"),
		}),
		smtp: () => ({
			host: requireRaw("AUTH_MAIL_SMTP_HOST"),
			port: requireInt("AUTH_MAIL_SMTP_PORT"),
			secure: requireRaw("AUTH_MAIL_SMTP_SECURE") === "true",
			auth: raw("AUTH_MAIL_SMTP_USER")
				? {
						user: requireRaw("AUTH_MAIL_SMTP_USER"),
						pass: requireRaw("AUTH_MAIL_SMTP_PASS"),
					}
				: undefined,
		}),
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
	{ name: "ACCESS_JWT_PUBLIC_JWKS" },
	{ name: "ACCESS_JWT_ISSUER" },
	{ name: "ACCESS_JWT_AUDIENCE" },
	{ name: "SERVICE_TOKEN", secret: true },
	// storage
	{ name: "STORAGE_TENANT_SERVICES" },
	{ name: "STORAGE_SCOPE" },
	// cache (valkey)
	{ name: "STORAGE_VALKEY_PORT" },
	// demo
	{ name: "LANDING_DEMO_MODE" },
	// auth-gateway magic-link delivery
	{ name: "AUTH_MAIL_TRANSPORT" },
	{ name: "AUTH_MAIL_FROM" },
	{ name: "AUTH_MAIL_SES_ACCESS_KEY_ID", secret: true },
	{ name: "AUTH_MAIL_SES_SECRET_ACCESS_KEY", secret: true },
	{ name: "AUTH_MAIL_SES_REGION" },
	{ name: "AUTH_MAIL_SMTP_HOST" },
	{ name: "AUTH_MAIL_SMTP_PORT" },
	{ name: "AUTH_MAIL_SMTP_SECURE" },
	{ name: "AUTH_MAIL_SMTP_USER" },
	{ name: "AUTH_MAIL_SMTP_PASS", secret: true },
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
	settings.core.accessJwtPublicJwks,
	settings.core.accessJwtIssuer,
	settings.core.accessJwtAudience,
	settings.core.servicesBase,
	settings.cache.valkeyPort,
	settings.storage.tenantServices,
];
