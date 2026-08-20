import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Subprocess, spawn } from "bun";
import {
	PROJECT_ROOT,
	pipeOutput,
	resolveNativeApps,
	startNativeApps,
	withParentDeath,
} from "./apps";

const PROJECT_DIR = PROJECT_ROOT;

type Args = { envFile?: string; uiOnly: boolean; noUi: boolean };

function parseArgs(argv: string[]): Args {
	const args: Args = { uiOnly: false, noUi: false };
	for (const arg of argv) {
		if (arg.startsWith("--env-file=")) args.envFile = arg.slice("--env-file=".length);
		else if (arg === "--ui-only") args.uiOnly = true;
		else if (arg === "--no-ui") args.noUi = true;
		else throw new Error(`[dev] unknown argument: ${arg}`);
	}
	if (args.uiOnly && args.noUi) {
		throw new Error("[dev] --ui-only and --no-ui are mutually exclusive");
	}
	return args;
}

function parseDotEnv(content: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
		const eq = normalized.indexOf("=");
		if (eq <= 0) continue;
		const key = normalized.slice(0, eq).trim();
		let value = normalized.slice(eq + 1).trim();
		const quoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"));
		if (quoted) value = value.slice(1, -1);
		else {
			const comment = value.indexOf(" #");
			if (comment >= 0) value = value.slice(0, comment).trim();
		}
		env[key] = value;
	}
	return env;
}

const args = parseArgs(process.argv.slice(2));
if (!args.envFile) throw new Error("[dev] --env-file is required");

const envPath = resolve(PROJECT_DIR, args.envFile);
if (!existsSync(envPath)) throw new Error(`[dev] env file not found: ${envPath}`);
// The shell wins over the file: an inline override must not need a file edit.
const fileEnv = parseDotEnv(readFileSync(envPath, "utf8"));
const env: Record<string, string> = { ...fileEnv };
for (const [key, value] of Object.entries(process.env)) {
	if (value !== undefined) env[key] = value;
}
console.log(`[dev] env: ${envPath}`);

const startUi = !args.noUi;
const startServices = !args.uiOnly;

const port = Number(env.PORT ?? "3001");
const landingPort = Number(env.LANDING_PORT ?? String(port + 1));
if (!Number.isFinite(port)) throw new Error(`[dev] invalid PORT: ${env.PORT}`);
if (!Number.isFinite(landingPort)) {
	throw new Error(`[dev] invalid LANDING_PORT: ${env.LANDING_PORT}`);
}

const dataDir = env.DATA_DIR || resolve(PROJECT_DIR, "data");

const solutionPath =
	env.SOLUTION_PATH || resolve(PROJECT_DIR, "solutions", "converged.json");
const solution = JSON.parse(readFileSync(solutionPath, "utf8"));
const microfrontends: string[] = solution.spec?.microfrontends ?? [];
const microservices: string[] = solution.spec?.microservices ?? [];

/**
 * Storage mounts one root per microservice and refuses to create any of them:
 * a missing directory means the volume is not mounted. Deriving the file from
 * the Solution keeps one list — adding a module to the Solution is all it takes
 * for its data root to exist.
 */
function writeMountsConfig(): string {
	const mounts: Record<string, string> = {};
	for (const name of microservices) {
		const root = resolve(dataDir, `${name}-ms`);
		mkdirSync(root, { recursive: true });
		mounts[`${name}-ms`] = root;
	}
	const path = resolve(dataDir, "mounts.json");
	writeFileSync(path, `${JSON.stringify({ microservices: mounts }, null, 2)}\n`);
	return path;
}

mkdirSync(dataDir, { recursive: true });
const mountsConfig = writeMountsConfig();
console.log(`[dev] storage mounts: ${mountsConfig} (${microservices.length} roots)`);

const runtimeEnv: Record<string, string> = {
	...env,
	DATA_DIR: dataDir,
	SOLUTION_PATH: solutionPath,
	PROJECT_DIR,
	BEHEMOTH_STORAGE_CONFIG: resolve(dataDir, "mounts.json"),
	FUJIN_ZMQ_ENDPOINT: env.FUJIN_ZMQ_ENDPOINT || "tcp://127.0.0.1:5557",
	FUJIN_WS_URL: env.FUJIN_WS_URL || "ws://127.0.0.1:8087/ws",
};

console.log(
	`[dev] solution ${solution.metadata?.name}: ` +
		`${solution.spec?.microservices?.length ?? 0} ms, ${microfrontends.length} mf`,
);

const procs: Subprocess[] = [];
let cleaned = false;
const killChildren = () => {
	for (const proc of procs) {
		try {
			proc.kill();
		} catch {}
	}
};
const cleanup = (code = 0) => {
	if (cleaned) return;
	cleaned = true;
	console.log("\n[dev] shutting down...");
	killChildren();
	process.exit(code);
};
process.on("SIGINT", () => cleanup());
process.on("SIGTERM", () => cleanup());
process.on("exit", killChildren);

const watch = (proc: Subprocess, name: string) => {
	void proc.exited.then((code) => {
		if (cleaned) return;
		console.error(`[dev] "${name}" exited with code ${code ?? "unknown"}`);
		cleanup(1);
	});
};

// ui-only talks to the cluster started by a sibling `dev` process, so it must
// not launch a second copy of the native peers.
const nativeApps = startServices
	? resolveNativeApps(
			(env.CONVERGED_DEV_APPS ?? "")
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
			dataDir,
			mountsConfig,
			runtimeEnv,
		)
	: [];

if (nativeApps.length > 0) {
	console.log(`[dev] native apps: ${nativeApps.map((a) => a.name).join(", ")}`);
	await startNativeApps(nativeApps, procs, (name, code) => {
		if (cleaned) return;
		console.error(`[dev] native app "${name}" exited with code ${code ?? "unknown"}`);
		cleanup(1);
	});
}

if (startServices) {
	const proc = spawn({
		cmd: withParentDeath(["bun", "run", "src/dev.ts"]),
		cwd: resolve(PROJECT_DIR, "core/backend"),
		env: {
			...runtimeEnv,
			PORT: String(port),
			FUJIN_TARGET: env.FUJIN_TARGET || "services",
		},
		// Left attached: back-core is long-lived and noisy, and an extra JS pipe
		// delays exactly the startup errors worth seeing immediately.
		stdout: "inherit",
		stderr: "inherit",
	});
	procs.push(proc);
	watch(proc, "ms");
}

if (startUi) {
	const landingDir = resolve(PROJECT_DIR, "core/frontend/landing");
	if (!existsSync(landingDir)) {
		throw new Error(`[dev] landing not found: ${landingDir}`);
	}
	const proc = spawn({
		// SPA assets rebuild themselves, but the SSR plugin is an imported module
		// and needs a process restart when its route code changes.
		cmd: withParentDeath(["bun", "--watch", "run", "src/dev.ts"]),
		cwd: landingDir,
		env: {
			...runtimeEnv,
			PORT: String(landingPort),
			MICROFRONTENDS: microfrontends.join(","),
			FUJIN_TARGET: env.FUJIN_TARGET || "ui",
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	pipeOutput(proc, "ui");
	procs.push(proc);
	watch(proc, "ui");
}

if (procs.length === 0) {
	throw new Error("[dev] nothing to run for this mode");
}

const rows: Array<[string, string]> = [
	...nativeApps.map((a) => [a.name, a.dir.replace(`${PROJECT_DIR}/`, "")] as [string, string]),
	...(startServices ? [["ms", `http://localhost:${port}`] as [string, string]] : []),
	...(startUi ? [["ui", `http://localhost:${landingPort}`] as [string, string]] : []),
];
const width = Math.max(...rows.map(([name]) => name.length));
console.log("\nPorts:");
for (const [name, url] of rows) console.log(`  ${name.padEnd(width)}  ${url}`);
console.log("");

await Promise.race(procs.map((p) => p.exited));
cleanup();
