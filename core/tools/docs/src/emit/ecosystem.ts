/**
 * The ecosystem page: the module registry, rendered as landing data.
 *
 * Structure comes from the source tree — which modules exist, which domain
 * they sit in, which solution claims them, how many there are. Wording comes
 * from `<project>/docs/ecosystem/landing.json` and translated content caches,
 * next to the rest of that language's docs so `translation-control` already
 * covers it.
 *
 * The split matters: adding a module must change the page without anyone
 * editing the page. A domain or solution with no wording falls back to its own
 * id rather than disappearing, so an unlabelled newcomer shows up plainly
 * instead of silently going missing.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Writer } from "../fs";
import type { ModuleEntry, Registry, SolutionEntry } from "../registry";
import type { Config } from "../types";

/** A module as the landing block reads it. */
type RegistryModule = {
	name: string;
	kind: string;
	purpose: string;
	path: string;
	href?: string;
};

/** One collapsible group in the registry block. */
type RegistryGroup = {
	id: string;
	title: string;
	summary?: string;
	meta?: string[];
	modules: RegistryModule[];
};

type RegistryData = {
	eyebrow?: string;
	title: string;
	description?: string;
	note?: string;
	countLabel?: string;
	groups: RegistryGroup[];
};

/** `<project>/docs/ecosystem/landing.json`. */
type LandingCopy = {
	title?: string;
	hero?: Record<string, unknown>;
	openness?: Record<string, unknown>;
	stats?: {
		heading?: string;
		link?: { text: string; url: string };
		labels?: Partial<Record<StatKey, string>>;
	};
	registry?: Omit<RegistryData, "groups">;
	solutions?: Omit<RegistryData, "groups">;
	kinds?: Record<string, string>;
	domains?: Record<string, string>;
	solutionTitles?: Record<string, { title?: string; summary?: string }>;
	labels?: {
		depends?: string;
		/** One form, or forms keyed by CLDR plural category. */
		modules?: string | Record<string, string>;
	};
	nav?: Array<{ blockId: string; label: string }>;
};

type StatKey = "repository" | "lambda" | "surface" | "workflow" | "solution";

const STAT_ORDER: StatKey[] = [
	"repository",
	"lambda",
	"surface",
	"workflow",
	"solution",
];

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * "1 модуль" vs "5 модулей" rather than a naive "1 модулей" in a language
 * with real plural forms: the form is chosen by CLDR plural category, so a
 * language declares only the forms it actually has.
 */
function count(
	template: string | Record<string, string> | undefined,
	value: number,
	lang: string,
): string {
	if (!template) return String(value);

	const form =
		typeof template === "string"
			? template
			: (template[new Intl.PluralRules(lang).select(value)] ??
				template.other ??
				Object.values(template)[0] ??
				"{count}");

	return form.replace("{count}", String(value));
}

/**
 * Where a language's landing copy can be: authored beside the code, or
 * translated into the cache. The source language is the only one an owner
 * keeps, so every other one is found in the cache.
 */
function copyPaths(config: Config, lang: string): string[] {
	const paths: string[] = [];
	if (lang === config.translation.sourceLocale) {
		paths.push(
			...config.projects.map((project) =>
				join(project, "docs", "ecosystem", "landing.json"),
			),
		);
	}
	paths.push(
		...[...config.docsCaches.values()].map((cache) =>
			join(cache, lang, "ecosystem", "landing.json"),
		),
	);
	if (config.contentCache)
		paths.push(
			join(config.contentCache, "struct", lang, "ecosystem", "landing.json"),
		);
	if (config.content) {
		paths.push(
			join(config.content, "struct", lang, "ecosystem", "landing.json"),
		);
	}
	return paths;
}

/**
 * Merges the copy every project contributes for one language. Later paths win
 * key by key, so a downstream product can relabel a domain without restating
 * the whole file, and a translation overrides the source it was made from.
 */
async function readCopy(
	config: Config,
	lang: string,
): Promise<LandingCopy | null> {
	let merged: LandingCopy | null = null;

	for (const path of copyPaths(config, lang)) {
		if (!existsSync(path)) continue;

		const copy = (await Bun.file(path).json()) as LandingCopy;
		if (!merged) {
			merged = copy;
			continue;
		}

		const base: LandingCopy = merged;
		merged = {
			...base,
			...copy,
			kinds: { ...base.kinds, ...copy.kinds },
			domains: { ...base.domains, ...copy.domains },
			solutionTitles: { ...base.solutionTitles, ...copy.solutionTitles },
			labels: { ...base.labels, ...copy.labels },
		};
	}

	return merged;
}

function sourceHref(config: Config, module: ModuleEntry): string | undefined {
	const repo = config.ecosystem.repos[module.project];
	return repo ? `${repo}/tree/master/${module.path}` : undefined;
}

function toModule(
	config: Config,
	copy: LandingCopy,
	module: ModuleEntry,
): RegistryModule {
	const href = sourceHref(config, module);
	return {
		name: module.name,
		kind: copy.kinds?.[module.kind] ?? module.kind,
		purpose: module.purpose,
		path: module.path,
		...(href ? { href } : {}),
	};
}

/**
 * Registry grouped the way the tree is laid out: by domain, by kind for
 * workflows — which have no domain level at all — and by project for a product
 * layer that dropped the domain level from its backend modules.
 */
function byDomain(
	config: Config,
	copy: LandingCopy,
	modules: ModuleEntry[],
	lang: string,
): RegistryGroup[] {
	const groups = new Map<string, ModuleEntry[]>();
	for (const module of modules) {
		const key =
			module.domain ||
			(module.kind === "workflow" ? "workflows" : module.project);
		groups.set(key, [...(groups.get(key) ?? []), module]);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([id, entries]) => ({
			id,
			title: copy.domains?.[id] ?? id,
			meta: [count(copy.labels?.modules, entries.length, lang)],
			modules: entries.map((entry) => toModule(config, copy, entry)),
		}));
}

/** Registry grouped by solution, with each solution's dependencies as chips. */
function bySolution(
	config: Config,
	copy: LandingCopy,
	registry: Registry,
	lang: string,
): RegistryGroup[] {
	const byName = new Map(registry.modules.map((m) => [m.name, m]));

	return registry.solutions.map((solution: SolutionEntry) => {
		const labels = copy.solutionTitles?.[solution.id];
		const depends = solution.depends.map(
			(id) => copy.solutionTitles?.[id]?.title ?? id,
		);

		return {
			id: solution.id,
			title: labels?.title ?? solution.id,
			...(labels?.summary ? { summary: labels.summary } : {}),
			meta: [
				count(copy.labels?.modules, solution.modules.length, lang),
				...(depends.length > 0
					? [`${copy.labels?.depends ?? "depends"}: ${depends.join(", ")}`]
					: []),
			],
			modules: solution.modules.flatMap((name) => {
				const module = byName.get(name);
				return module ? [toModule(config, copy, module)] : [];
			}),
		};
	});
}

function stats(copy: LandingCopy, registry: Registry) {
	const totals: Record<StatKey, number> = {
		repository: 0,
		lambda: 0,
		surface: 0,
		workflow: 0,
		solution: registry.solutions.length,
	};
	for (const module of registry.modules) totals[module.kind] += 1;

	return {
		heading: copy.stats?.heading ?? "",
		...(copy.stats?.link ? { link: copy.stats.link } : {}),
		stats: STAT_ORDER.map((key) => ({
			id: key,
			value: String(totals[key]),
			label: copy.stats?.labels?.[key] ?? key,
		})),
	};
}

/**
 * The page itself. Blocks that only render copy reuse the existing landing
 * blocks; the two registry blocks are the same component fed different
 * groupings, which is why solutions and domains stay visually consistent.
 */
function page(copy: LandingCopy, dir: string) {
	const blocks = [
		{
			id: "navbar",
			type: "navbar",
			sources: { ui: "landings/common/ui.json" },
		},
		{
			id: "hero-main",
			type: "hero-main",
			sources: { heroMain: `${dir}/hero.json` },
		},
		{ id: "scale", type: "stats", sources: { stats: `${dir}/stats.json` } },
		{
			id: "openness",
			type: "feature",
			sources: { feature: `${dir}/openness.json` },
		},
		{
			id: "solutions",
			type: "module-registry",
			sources: { registry: `${dir}/solutions.json` },
		},
		{
			id: "modules",
			type: "module-registry",
			sources: { registry: `${dir}/modules.json` },
		},
	];

	const menuLinks = (copy.nav ?? []).filter((link) =>
		blocks.some((block) => block.id === link.blockId),
	);

	return {
		id: "ecosystem",
		title: copy.title ?? "Ecosystem",
		...(menuLinks.length > 0 ? { navigation: { menuLinks } } : {}),
		blocks,
	};
}

/**
 * Languages the page has copy for. Asked of the sources rather than of the
 * scanned books, because the page can exist in a language before that language
 * has any documentation.
 */
function authoredLangs(config: Config): string[] {
	const langs = new Set<string>();
	const roots = [
		...config.docsCaches.values(),
		...(config.contentCache ? [join(config.contentCache, "struct")] : []),
		...(config.content ? [join(config.content, "struct")] : []),
	];
	const sourceLocale = config.translation.sourceLocale;
	if (
		config.projects.some((project) =>
			existsSync(join(project, "docs", "ecosystem", "landing.json")),
		)
	) {
		langs.add(sourceLocale);
	}

	for (const root of roots) {
		if (!existsSync(root)) continue;
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (existsSync(join(root, entry.name, "ecosystem", "landing.json"))) {
				langs.add(entry.name);
			}
			if (
				existsSync(
					join(root, entry.name, "content", "ecosystem", "landing.json"),
				)
			) {
				langs.add(entry.name);
			}
		}
	}
	return [...langs].sort();
}

export async function emitEcosystem(
	registry: Registry,
	config: Config,
	writer: Writer,
	langs: string[] = [],
): Promise<string[]> {
	const dir = config.ecosystem.landing;
	const written: string[] = [];
	const targets = langs.length > 0 ? langs : authoredLangs(config);

	for (const lang of targets) {
		const copy = await readCopy(config, lang);
		// No copy for a language means the page was never authored there; an
		// untranslated wall of English ids helps nobody.
		if (!copy) continue;

		const root = join(config.out.struct, lang, dir);
		await writer.write(join(root, "index.json"), json(page(copy, dir)));
		await writer.write(join(root, "hero.json"), json(copy.hero ?? {}));
		await writer.write(join(root, "openness.json"), json(copy.openness ?? {}));
		await writer.write(join(root, "stats.json"), json(stats(copy, registry)));
		await writer.write(
			join(root, "solutions.json"),
			json({
				...(copy.solutions ?? { title: "" }),
				groups: bySolution(config, copy, registry, lang),
			} satisfies RegistryData),
		);
		await writer.write(
			join(root, "modules.json"),
			json({
				...(copy.registry ?? { title: "" }),
				groups: byDomain(config, copy, registry.modules, lang),
			} satisfies RegistryData),
		);
		written.push(lang);
	}

	return written;
}
