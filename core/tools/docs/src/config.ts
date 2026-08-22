import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Config, SectionConfig } from "./types";

/** Tool directory: `<business>/converged/core/tools/docs`. */
const TOOL_ROOT = resolve(import.meta.dir, "..");

export const DEFAULT_CONFIG_PATH = resolve(TOOL_ROOT, "docs.config.json");

type RawConfig = {
	projects?: string[];
	out?: Partial<Record<keyof Config["out"], string>>;
	sections?: Record<string, SectionConfig>;
	translation?: Partial<Config["translation"]>;
};

/**
 * Defaults assume the standard checkout: converged and the product layer are
 * siblings, and the running solution's data lives under `<business>/data/club`.
 * Everything here is overridable from `docs.config.json`.
 */
const DEFAULTS: Required<RawConfig> = {
	projects: ["../../..", "../../../../club"],
	out: {
		struct: "../../../../data/club/struct-ms/struct/data",
		markdown: "../../../../data/club/markdown-ms/markdown/data",
		readme: "../../../../build/docs/readme",
		html: "../../../../build/docs/html",
		pdf: "../../../../build/docs/pdf",
	},
	sections: {},
	translation: {
		config: "../../../../build/docs/translation-control.json",
		stateDir: "../../../../build/docs/translation",
		sourceLocale: "en",
		targetLocales: [],
	},
};

function resolveFrom(root: string, path: string): string {
	return isAbsolute(path) ? path : resolve(root, path);
}

export async function loadConfig(configPath?: string): Promise<Config> {
	const path = configPath ? resolve(configPath) : DEFAULT_CONFIG_PATH;
	let raw: RawConfig = {};

	if (existsSync(path)) {
		raw = (await Bun.file(path).json()) as RawConfig;
	} else if (configPath) {
		throw new Error(`Config not found: ${path}`);
	}

	const root = dirname(path);
	const out = { ...DEFAULTS.out, ...(raw.out ?? {}) } as Record<
		keyof Config["out"],
		string
	>;

	// A project root that is not checked out is normal — the product layer is a
	// git submodule and may be absent — so missing ones are dropped, not fatal.
	const projects = (raw.projects ?? DEFAULTS.projects)
		.map((p) => resolveFrom(root, p))
		.filter((p) => existsSync(p));

	if (projects.length === 0) {
		throw new Error(
			`No project root exists, nothing to scan (config: ${path})`,
		);
	}

	return {
		root,
		projects,
		out: {
			struct: resolveFrom(root, out.struct),
			markdown: resolveFrom(root, out.markdown),
			readme: resolveFrom(root, out.readme),
			html: resolveFrom(root, out.html),
			pdf: resolveFrom(root, out.pdf),
		},
		sections: raw.sections ?? DEFAULTS.sections,
		translation: {
			...DEFAULTS.translation,
			...(raw.translation ?? {}),
			config: resolveFrom(
				root,
				raw.translation?.config ?? DEFAULTS.translation.config,
			),
			stateDir: resolveFrom(
				root,
				raw.translation?.stateDir ?? DEFAULTS.translation.stateDir,
			),
		},
	};
}
