import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Subprocess, spawn, which } from "bun";

/** The converged project root: `<root>/core/tools/dev/src` is this file. */
export const PROJECT_ROOT = resolve(import.meta.dir, "../../../..");
const WRAPPERS = resolve(PROJECT_ROOT, "core/native/wrappers");
const ARTIFACTS = resolve(WRAPPERS, "artifacts/libs");

/** Host triple used to pick a prebuilt artifact out of a wrapper's target map. */
function hostTarget(): string {
	switch (process.arch) {
		case "x64":
			return "x86_64-gnu";
		case "arm64":
			return "aarch64-gnu";
		default:
			throw new Error(`[dev] unsupported host architecture: ${process.arch}`);
	}
}

/**
 * Wrapper libraries are content-addressed: `zig build -Dall` writes
 * `artifacts/libs/<sha256>.so` and records the target→hash map in the
 * wrapper's `current.json`. Resolving through that map is what keeps dev and
 * the container pointing at the same bytes; a hardcoded `zig-out` path would
 * drift the moment either side rebuilds.
 */
export function wrapperLib(wrapperPath: string): string {
	const mapPath = resolve(WRAPPERS, wrapperPath, "current.json");
	if (!existsSync(mapPath)) {
		throw new Error(
			`[dev] wrapper not built: ${wrapperPath}\n` +
				`  cd ${resolve(WRAPPERS, wrapperPath)} && zig build -Dall`,
		);
	}
	const target = hostTarget();
	const hash = (
		JSON.parse(readFileSync(mapPath, "utf8")) as Record<string, string>
	)[target];
	if (!hash) {
		throw new Error(
			`[dev] wrapper ${wrapperPath} has no artifact for ${target}`,
		);
	}
	const lib = resolve(ARTIFACTS, `${hash}.so`);
	if (!existsSync(lib)) {
		throw new Error(
			`[dev] wrapper ${wrapperPath}: artifact missing for ${target}: ${lib}\n` +
				`  cd ${resolve(WRAPPERS, wrapperPath)} && zig build -Dall`,
		);
	}
	return lib;
}

export interface NativeApp {
	name: string;
	/** Processors are selected by the resolved Solution, not DEV_APPS. */
	kind?: "app" | "processor";
	/** Source directory relative to the project root. Defaults to native/apps. */
	dir?: string;
	/** Start order; the router must own its socket before its peers dial it. */
	order: number;
	bin: string;
	args?: string[];
	/** Directories added to LD_LIBRARY_PATH, relative to the app directory. */
	libDirs?: string[];
	/** Milliseconds to wait after spawn before starting the next app. */
	readyDelayMs?: number;
	env?: () => Record<string, string>;
}

const FUJIN_ZMQ = "tcp://127.0.0.1:5557";

/**
 * A native library resonus dlopens by absolute path, as installed next to its
 * binary by `core/native/apps/resonus/build.sh`.
 *
 * These are not content-addressed like the `wrapperLib` artifacts, so they need
 * naming explicitly — and they must be, because resonus derives its own default
 * from a project layout that no longer exists (`<root>/native/wrapers/...`,
 * before the wrappers became submodules under `core/native/wrappers/<group>`).
 * The container image names them the same way, in its ENV block; dev had no
 * equivalent, so WebRTC failed at the first `call.offer` with
 * DataChannelWrapperUnavailable while everything else worked.
 */
function resonusLib(name: string): string {
	return resolve(
		PROJECT_ROOT,
		"core/native/apps/resonus/zig-out/x86_64-gnu/lib",
		name,
	);
}

/**
 * Same story as `resonusLib`, for behemoth. Storage dlopens libryugraph and
 * reads its memory control script by absolute path, and it now refuses to start
 * when the script is missing — so dev has to name both explicitly, exactly as
 * the container image does in its ENV block.
 */
function behemothPath(...parts: string[]): string {
	return resolve(PROJECT_ROOT, "core/native/apps/behemoth", ...parts);
}

function processorPath(name: string, ...parts: string[]): string {
	return resolve(PROJECT_ROOT, "core/native/processors", name, ...parts);
}

/**
 * The native peers of the cluster. In production each is its own container;
 * dev runs the same set as local processes so the topology is identical and
 * only the addresses differ.
 */
export const NATIVE_APPS: NativeApp[] = [
	{
		name: "fujin",
		order: 0,
		bin: "zig-out/x86_64-gnu/bin/fujin",
		readyDelayMs: 500,
		env: () => ({
			FUJIN_ZMQ_BIND: FUJIN_ZMQ,
			FUJIN_WS_HOST: "127.0.0.1",
			FUJIN_WS_PORT: "8087",
			FUJIN_FLUENTBIT: "off",
			FUJIN_QJS_LIB: wrapperLib("rt/qjs"),
			FUJIN_ZIMQ_LIB: wrapperLib("protocols/zimq"),
		}),
	},
	{
		name: "behemoth",
		order: 1,
		bin: "zig-out/x86_64-gnu/bin/storage",
		// There is no shared data directory any more: every microservice is
		// mounted separately, and the mount file names them. In the cluster it
		// arrives from a ConfigMap that ptah writes; in dev the runner writes it.
		args: [
			"start",
			"--config",
			"${mountsConfig}",
			"--fujin",
			FUJIN_ZMQ,
			"--valkey",
			"127.0.0.1:6379",
		],
		libDirs: ["zig-out/x86_64-gnu/lib"],
		readyDelayMs: 300,
		env: () => ({
			BEHEMOTH_STORAGE_JS_SCRIPT: behemothPath("scripts/default-management.js"),
			BEHEMOTH_QJS_LIB: behemothPath("zig-out/x86_64-gnu/lib/libqjs.so"),
			RYUGRAPH_LIBRARY_PATH: behemothPath(
				"zig-out/x86_64-gnu/lib/libryugraph.so",
			),
		}),
	},
	{
		name: "centimanus",
		order: 2,
		bin: "zig-out/x86_64-gnu/bin/centimanus",
		args: ["127.0.0.1:9100"],
		libDirs: ["zig-out/x86_64-gnu/lib"],
		env: () => ({
			CENTIMANUS_FUJIN_ZMQ_ENDPOINT: FUJIN_ZMQ,
			RT_STATE_BACKEND: "memory",
		}),
	},
	{
		name: "resonus",
		order: 3,
		bin: "zig-out/x86_64-gnu/bin/resonus",
		args: ["serve"],
		libDirs: ["zig-out/x86_64-gnu/lib"],
		env: () => ({
			RESONUS_FUJIN_ZMQ_ENDPOINT: FUJIN_ZMQ,
			LLM_GATE_CONVERGED_ROOT: PROJECT_ROOT,
			LLM_GATE_QJS_LIB: wrapperLib("rt/qjs"),
			LLM_GATE_LIBDATACHANNEL_LIB: resonusLib("libdatachannel.so"),
			LLM_GATE_LIBDATACHANNEL_WRAPPER_LIB: resonusLib(
				"libdatachannel_wrapper.so",
			),
			LLM_GATE_BARESIP_LIB: resonusLib("libbaresip.so"),
			LLM_GATE_BARESIP_WRAPPER_LIB: resonusLib("libbaresip_wrapper.so"),
			LLM_GATE_MBEDTLS_LIB: resonusLib("libmbedtls.so"),
			LLM_GATE_POLICY_SCRIPT: resolve(
				PROJECT_ROOT,
				"core/native/apps/resonus/scripts/default.js",
			),
			// Dev always uses the provider bundle built in this checkout. An inherited
			// deployment path can point at an old project layout and prevent startup.
			RESONUS_PROVIDERS_DIR: resolve(
				PROJECT_ROOT,
				"core/native/apps/resonus/providers/dist",
			),
			LLM_GATE_HTTP_HOST: "127.0.0.1",
			LLM_GATE_HTTP_PORT: "8090",
			LLM_GATE_VALKEY_URL: "redis://127.0.0.1:6379/0",
			LLM_GATE_VALKEY_KEY_PREFIX: "cache",
			LLM_GATE_SIP_ENABLED: "false",
		}),
	},
	{
		name: "curaengine",
		kind: "processor",
		dir: "core/native/processors/curaengine",
		order: 4,
		bin: "zig-out/x86_64-linux-gnu/bin/curaengine",
		libDirs: ["zig-out/x86_64-linux-gnu/lib"],
		env: () => ({
			CURAENGINE_LIB: processorPath(
				"curaengine",
				"zig-out/x86_64-linux-gnu/lib/libcuraengine.so",
			),
			CURAENGINE_FUJIN_ZMQ_ENDPOINT: FUJIN_ZMQ,
		}),
	},
	{
		name: "opencamlib",
		kind: "processor",
		dir: "core/native/processors/opencamlib",
		order: 4,
		bin: "zig-out/x86_64-linux-gnu/bin/opencamlib",
		libDirs: ["zig-out/x86_64-linux-gnu/lib"],
		env: () => ({
			OPENCAMLIB_LIB: processorPath(
				"opencamlib",
				"zig-out/x86_64-linux-gnu/lib/libopencamlib.so",
			),
			OPENCAMLIB_FUJIN_ZMQ_ENDPOINT: FUJIN_ZMQ,
		}),
	},
];

let pdeathsig: boolean | undefined;

/**
 * A hard-killed dev process must not leave native peers holding ports. The
 * signal handlers below cover an orderly exit; only PR_SET_PDEATHSIG covers
 * SIGKILL, so prefer it when the host has setpriv.
 */
export function withParentDeath(cmd: string[], signal = "SIGTERM"): string[] {
	if (pdeathsig === undefined) {
		pdeathsig = process.platform === "linux" && which("setpriv") !== null;
		if (!pdeathsig) {
			console.warn(
				"[dev] setpriv unavailable — a hard-killed dev process may orphan native apps",
			);
		}
	}
	return pdeathsig ? ["setpriv", "--pdeathsig", signal, "--", ...cmd] : cmd;
}

export interface ResolvedApp {
	name: string;
	dir: string;
	bin: string;
	args: string[];
	env: Record<string, string>;
	readyDelayMs: number;
}

export function selectNativeApps(
	selection: string[],
	processors: string[],
	workflowCount = 0,
): NativeApp[] {
	const wanted = selection.length > 0 ? new Set(selection) : null;
	const selectedProcessors = new Set(processors);
	return NATIVE_APPS.filter((app) =>
		app.kind === "processor"
			? selectedProcessors.has(app.name)
			: app.name === "centimanus" && workflowCount > 0
				? true
				: !wanted || wanted.has(app.name),
	).sort((a, b) => a.order - b.order);
}

export function resolveNativeApps(
	selection: string[],
	processors: string[],
	workflowCount: number,
	dataDir: string,
	mountsConfig: string,
	baseEnv: Record<string, string>,
): ResolvedApp[] {
	return selectNativeApps(selection, processors, workflowCount).map((app) => {
		const dir = resolve(
			PROJECT_ROOT,
			app.dir ?? `core/native/apps/${app.name}`,
		);
		const bin = resolve(dir, app.bin);
		if (!existsSync(bin)) {
			throw new Error(
				`[dev] native app "${app.name}": binary not found: ${bin}\n` +
					`  build it in ${dir}`,
			);
		}

		const expand = (value: string) =>
			value
				.replaceAll("${dir}", dir)
				.replaceAll("${dataDir}", dataDir)
				.replaceAll("${mountsConfig}", mountsConfig);

		const libDirs = (app.libDirs ?? [])
			.map((d) => resolve(dir, d))
			.filter((d) => existsSync(d));
		const ldPath = [...libDirs, baseEnv.LD_LIBRARY_PATH]
			.filter(Boolean)
			.join(":");

		return {
			name: app.name,
			dir,
			bin,
			args: (app.args ?? []).map(expand),
			readyDelayMs: app.readyDelayMs ?? 0,
			env: {
				...baseEnv,
				...(app.env?.() ?? {}),
				...(ldPath ? { LD_LIBRARY_PATH: ldPath } : {}),
			},
		};
	});
}

export function pipeOutput(proc: Subprocess, label: string): void {
	for (const [stream, sink] of [
		[proc.stdout, process.stdout],
		[proc.stderr, process.stderr],
	] as const) {
		if (!stream || typeof stream === "number") continue;
		void (async () => {
			const decoder = new TextDecoder();
			let buffer = "";
			for await (const chunk of stream as ReadableStream<Uint8Array>) {
				buffer += decoder.decode(chunk, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) sink.write(`[${label}] ${line}\n`);
			}
			if (buffer) sink.write(`[${label}] ${buffer}\n`);
		})();
	}
}

export async function startNativeApps(
	apps: ResolvedApp[],
	procs: Subprocess[],
	onExit: (name: string, code: number | null) => void,
): Promise<void> {
	for (const app of apps) {
		const proc = spawn({
			cmd: withParentDeath([app.bin, ...app.args]),
			cwd: app.dir,
			env: app.env,
			stdout: "pipe",
			stderr: "pipe",
		});
		pipeOutput(proc, app.name);
		procs.push(proc);
		void proc.exited.then((code) => onExit(app.name, code));
		if (app.readyDelayMs > 0) {
			await Bun.sleep(app.readyDelayMs);
		}
	}
}
