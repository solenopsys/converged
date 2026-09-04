import { createDomain, type Domain, type EventCallable, type Store } from "effector";
import type { FunctionBrief, OrchestratorCatalog, ToolSpec } from "../types";

// The catalog is state, not a constructor argument: microfrontends arrive while
// the chat runs, the backend answers with its own list, rights change. A source
// publishes `key → what it does` — enough for route/select — and the argument
// schema is fetched lazily by key, at the step that needs it.

export type CatalogGroup = "core" | "ui" | "backend" | (string & {});

export type CatalogMeta = {
	id: string;
	brief?: string;
	description: string;
	category?: string;
	priority?: FunctionBrief["priority"];
	parameters?: ToolSpec["parameters"];
};

export type CatalogSource = {
	id: string;
	group: CatalogGroup;
	/** Namespace for ids of this source; absent means the keys are used as-is. */
	prefix?: string;
	/** A host where the group cannot run keeps it out of the candidates. */
	available?: () => boolean;
	meta?(key: string): CatalogMeta | undefined;
	load?(key: string): Promise<ToolSpec["parameters"] | void>;
	invoke(key: string, args: Record<string, unknown>): unknown | Promise<unknown>;
};

export type CatalogEntry = FunctionBrief & {
	/** The key inside its source — what `invoke`/`meta` are called with. */
	key: string;
	source: string;
	group: CatalogGroup;
};

export type ConversationCatalog = {
	domain: Domain;
	$sources: Store<Map<string, CatalogSource>>;
	$functions: Store<Map<string, CatalogEntry>>;
	sourceRegistered: EventCallable<CatalogSource>;
	sourceRemoved: EventCallable<string>;
	/** Replaces one source's slice: this is how a lazy list arrives. */
	functionsPublished: EventCallable<{
		source: string;
		functions: FunctionBrief[];
	}>;
	/** Live view: follows the store, for hosts that register while running. */
	catalog: OrchestratorCatalog;
	/**
	 * Frozen view for one turn: a function chosen by `select` must still exist at
	 * `invoke`. A catalog moving underfoot mid-turn is broken integrity, not a
	 * race to survive.
	 */
	snapshot(): OrchestratorCatalog;
	entry(id: string): CatalogEntry | undefined;
};

const DEFAULT_LIMIT = 12;

const qualify = (source: CatalogSource, key: string): string =>
	source.prefix ? `${source.prefix}${key}` : key;

const rank = (
	functions: CatalogEntry[],
	query: string,
	limit: number,
): Array<{ entry: CatalogEntry; weak: boolean }> => {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	return (
		functions
			.map((entry) => ({
				entry,
				hits: words.filter((word) =>
					`${entry.id} ${entry.brief} ${entry.description ?? ""}`
						.toLowerCase()
						.includes(word),
				).length,
			}))
			.filter(({ hits }) => hits > 0)
			.sort(
				(left, right) =>
					right.hits - left.hits ||
					priorityWeight(right.entry.priority) -
						priorityWeight(left.entry.priority) ||
					left.entry.id.localeCompare(right.entry.id),
			)
			.slice(0, limit)
			// One word of a several-word request is a coincidence, not a match: it is
			// how "outreach audience configuration" reaches "Select Outreach targets".
			// Such a candidate is still offered — it may be all there is — but it is
			// labelled, so a call built on it is visibly a guess.
			.map(({ entry, hits }) => ({
				entry,
				weak: hits === 1 && words.length > 1,
			}))
	);
};

const priorityWeight = (priority: FunctionBrief["priority"]): number =>
	priority === "primary" ? 2 : priority === "secondary" ? 0 : 1;

export function createConversationCatalog(
	domain: Domain = createDomain("conversation-catalog"),
): ConversationCatalog {
	const sourceRegistered =
		domain.createEvent<CatalogSource>("SOURCE_REGISTERED");
	const sourceRemoved = domain.createEvent<string>("SOURCE_REMOVED");
	const functionsPublished = domain.createEvent<{
		source: string;
		functions: FunctionBrief[];
	}>("FUNCTIONS_PUBLISHED");

	const $sources = domain
		.createStore<Map<string, CatalogSource>>(new Map(), { name: "SOURCES" })
		.on(sourceRegistered, (sources, source) =>
			new Map(sources).set(source.id, source),
		)
		.on(sourceRemoved, (sources, id) => {
			if (!sources.has(id)) return sources;
			const next = new Map(sources);
			next.delete(id);
			return next;
		});

	const $functions = domain
		.createStore<Map<string, CatalogEntry>>(new Map(), { name: "FUNCTIONS" })
		.on(functionsPublished, (functions, { source, functions: published }) => {
			const owner = $sources.getState().get(source);
			if (!owner) {
				console.warn(
					`[orchestrator] Functions published for unknown source "${source}"`,
				);
				return functions;
			}
			const next = new Map(
				[...functions].filter(([, entry]) => entry.source !== source),
			);
			for (const fn of published) {
				next.set(qualify(owner, fn.id), {
					id: qualify(owner, fn.id),
					key: fn.id,
					brief: fn.brief,
					...(fn.description ? { description: fn.description } : {}),
					category: fn.category ?? owner.group,
					priority: fn.priority ?? "normal",
					// A function belongs to the module that implements it. Falling back
					// to the source keeps every entry addressable by module even when a
					// source publishes a flat list (workflows, a host's own tools).
					module: fn.module ?? source,
					...(fn.moduleLabel ? { moduleLabel: fn.moduleLabel } : {}),
					...(fn.approximate ? { approximate: true } : {}),
					...(fn.targetType ? { targetType: fn.targetType } : {}),
					...(fn.intent ? { intent: fn.intent } : {}),
					source,
					group: owner.group,
				});
			}
			return next;
		})
		.on(sourceRemoved, (functions, id) => {
			const next = new Map([...functions].filter(([, e]) => e.source !== id));
			return next.size === functions.size ? functions : next;
		});

	// The sources are frozen together with the functions: a view that resolved
	// `invoke` against the live map would lose a function mid-turn exactly when
	// the source it came from goes away.
	const viewOf = (
		entries: Map<string, CatalogEntry>,
		sources: Map<string, CatalogSource>,
	): OrchestratorCatalog => {
		const reachable = (entry: CatalogEntry): boolean => {
			const source = sources.get(entry.source);
			return Boolean(source && (source.available?.() ?? true));
		};

		const owner = (id: string) => {
			const entry = entries.get(id);
			const source = entry ? sources.get(entry.source) : undefined;
			return entry && source ? { entry, source } : undefined;
		};

		return {
			search: (query, limit = DEFAULT_LIMIT) =>
				rank([...entries.values()].filter(reachable), query, limit).map(
					({ entry, weak }) => ({
						id: entry.id,
						brief: entry.brief,
						...(entry.description ? { description: entry.description } : {}),
						category: entry.category,
						priority: entry.priority,
						...(entry.module ? { module: entry.module } : {}),
						...(entry.moduleLabel ? { moduleLabel: entry.moduleLabel } : {}),
						...(entry.targetType ? { targetType: entry.targetType } : {}),
						...(entry.intent ? { intent: entry.intent } : {}),
						...(weak || entry.approximate ? { approximate: true } : {}),
					}),
				),
			byTarget: (types) => {
				const wanted = new Set(types);
				return [...entries.values()]
					.filter(
						(entry) =>
							reachable(entry) &&
							entry.targetType !== undefined &&
							wanted.has(entry.targetType),
					)
					.sort(
						(left, right) =>
							priorityWeight(right.priority) - priorityWeight(left.priority) ||
							left.id.localeCompare(right.id),
					)
					.map((entry) => ({
						id: entry.id,
						brief: entry.brief,
						...(entry.description ? { description: entry.description } : {}),
						category: entry.category,
						priority: entry.priority,
						...(entry.module ? { module: entry.module } : {}),
						...(entry.moduleLabel ? { moduleLabel: entry.moduleLabel } : {}),
						targetType: entry.targetType,
						...(entry.intent ? { intent: entry.intent } : {}),
					}));
			},
			listModules: () => {
				const counts = new Map<string, number>();
				const labels = new Map<string, string>();
				for (const entry of entries.values()) {
					if (!reachable(entry) || !entry.module) continue;
					counts.set(entry.module, (counts.get(entry.module) ?? 0) + 1);
					if (entry.moduleLabel && !labels.has(entry.module))
						labels.set(entry.module, entry.moduleLabel);
				}
				return [...counts].map(([id, count]) => ({
					id,
					label: labels.get(id) ?? id,
					count,
				}));
			},
			listCategories: () => {
				const counts = new Map<string, number>();
				for (const entry of entries.values()) {
					if (!reachable(entry)) continue;
					const category = entry.category ?? entry.group;
					counts.set(category, (counts.get(category) ?? 0) + 1);
				}
				return [...counts].map(([id, count]) => ({ id, count }));
			},
			meta: (id) => {
				const found = owner(id);
				if (!found) return undefined;
				const meta = found.source.meta?.(found.entry.key);
				return (
					meta ?? {
						id,
						brief: found.entry.brief,
						description: found.entry.brief,
						category: found.entry.category,
					}
				);
			},
			invoke: (id, args) => {
				const found = owner(id);
				if (!found) throw new Error(`[orchestrator] Unknown function: "${id}"`);
				return found.source.invoke(found.entry.key, args);
			},
			load: async (id) => {
				const found = owner(id);
				return await found?.source.load?.(found.entry.key);
			},
		};
	};

	const live = (): OrchestratorCatalog =>
		viewOf($functions.getState(), $sources.getState());

	return {
		domain,
		$sources,
		$functions,
		sourceRegistered,
		sourceRemoved,
		functionsPublished,
		catalog: {
			search: (query, limit) => live().search(query, limit),
			listCategories: () => live().listCategories(),
			listModules: () => live().listModules?.() ?? [],
			byTarget: (types) => live().byTarget?.(types) ?? [],
			meta: (id) => live().meta(id),
			invoke: (id, args) => live().invoke(id, args),
			load: (id) => live().load?.(id) ?? Promise.resolve(),
		},
		snapshot: () =>
			viewOf(new Map($functions.getState()), new Map($sources.getState())),
		entry: (id) => $functions.getState().get(id),
	};
}
