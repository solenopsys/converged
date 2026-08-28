import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
	Config,
	DocsPageConfig,
	EcosystemConfig,
	SectionConfig,
	TranslationConfig,
} from "./types";

/** Tool directory: `<business>/converged/core/tools/docs`. */
const TOOL_ROOT = resolve(import.meta.dir, "..");

export const DEFAULT_CONFIG_PATH = resolve(TOOL_ROOT, "docs.config.json");

type RawConfig = {
	projects?: string[];
	content?: string;
	out?: Partial<Record<keyof Config["out"], string>>;
	sections?: Record<string, SectionConfig>;
	docsCache?: string;
	docsPage?: DocsPageConfig;
	ecosystem?: Partial<EcosystemConfig>;
	translation?: Partial<Config["translation"]>;
};

/**
 * Defaults assume the standard checkout: converged and the product layer are
 * siblings, and the running solution's data lives under `<business>/data/club`.
 * Everything here is overridable from `docs.config.json`.
 */
const DEFAULT_TRANSLATION: TranslationConfig = {
	config: "../../../content/docs-cache/.translation/control.json",
	stateDir: "../../../content/docs-cache/.translation",
	sourceLocale: "en",
	targetLocales: [],
};

const DEFAULT_ECOSYSTEM: EcosystemConfig = {
	landing: "landings/ecosystem",
	repos: {},
};

const DEFAULTS: Required<RawConfig> = {
	projects: ["../../..", "../../../../club"],
	out: {
		struct: "../../../../data/club/struct-ms/struct/data",
		markdown: "../../../../data/club/markdown-ms/markdown/data",
		static: "../../../../data/club/galery-ms/static",
		readme: "../../../../build/docs/readme",
		html: "../../../../build/docs/html",
		pdf: "../../../../build/docs/pdf",
	},
	sections: {},
	content: "../../../../club/content",
	docsCache: "content/docs-cache",
	docsPage: {},
	ecosystem: DEFAULT_ECOSYSTEM,
	translation: DEFAULT_TRANSLATION,
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
	const docsCache = raw.docsCache ?? DEFAULTS.docsCache;
	const docsCaches = new Map(
		projects
			.map((project) => [project, resolveFrom(project, docsCache)] as const)
			.filter(([, cache]) => existsSync(cache)),
	);
	const content = resolveFrom(root, raw.content ?? DEFAULTS.content);
	const configuredContentCache = join(content, "docs-cache");

	return {
		root,
		projects,
		content,
		out: {
			struct: resolveFrom(root, out.struct),
			markdown: resolveFrom(root, out.markdown),
			static: resolveFrom(root, out.static),
			readme: resolveFrom(root, out.readme),
			html: resolveFrom(root, out.html),
			pdf: resolveFrom(root, out.pdf),
		},
		sections: raw.sections ?? DEFAULTS.sections,
		// A cache that is not checked out is normal — it is a submodule — so an
		// absent one means "no translations", never an error.
		docsCaches,
		contentCache: existsSync(configuredContentCache)
			? configuredContentCache
			: "",
		docsPage: raw.docsPage ?? DEFAULTS.docsPage,
		ecosystem: {
			landing: raw.ecosystem?.landing ?? DEFAULT_ECOSYSTEM.landing,
			repos: raw.ecosystem?.repos ?? DEFAULT_ECOSYSTEM.repos,
		},
		translation: {
			...DEFAULT_TRANSLATION,
			...(raw.translation ?? {}),
			config: resolveFrom(
				root,
				raw.translation?.config ?? DEFAULT_TRANSLATION.config,
			),
			stateDir: resolveFrom(
				root,
				raw.translation?.stateDir ?? DEFAULT_TRANSLATION.stateDir,
			),
		},
	};
}
