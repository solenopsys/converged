import {
	catalogEntries,
	catalogEntry,
	focusedRef,
	focusItems,
	focusKey,
	invokeCatalogEntry,
	loadObjectType,
	microfrontendDeclared,
	microfrontendRegistered,
	type OperatorCatalogEntry,
	objectRegistry,
	onOperationAuthorizationChanged,
	operatorCatalogEntries,
	searchOperatorCatalog,
} from "front-core/object-runtime";
import { $activeLocale } from "../i18n";
import { loadSelectionDescriptor } from "../select/descriptor";
import { activeSelection } from "../select/runtime";
import { selectCommandSchema } from "../select/schema";
import type { ChatCatalog } from "./store";

type FunctionParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

function label(id: string): string | undefined {
	return catalogEntry(id)?.brief;
}

function categories() {
	return [{ id: "operator", count: catalogEntries().length }];
}

/**
 * The catalog's first level: which microfrontend owns each function. This is
 * what the routing step narrows to before a function is chosen, so a wrong pick
 * costs one visible wrong section instead of an unrelated call.
 */
function modules() {
	const counts = new Map<
		string,
		{ label: string; count: number; description?: string }
	>();
	for (const entry of catalogEntries()) {
		if (!entry.module) continue;
		const seen = counts.get(entry.module);
		if (seen) seen.count += 1;
		else
			counts.set(entry.module, {
				label: entry.moduleLabel ?? entry.module,
				count: 1,
				description: objectRegistry.moduleDescription(entry.module),
			});
	}
	return [...counts].map(([id, value]) => ({ id, ...value }));
}

// The operator's parameters carry every target type the resolver knows, which
// is the point of `describeFunction` and far too much for a listing: a bare
// `listFunctions` would answer with the whole registry seven times over.
function briefs(entries: OperatorCatalogEntry[]) {
	return entries.map(({ id, brief, description }) => ({
		id,
		brief,
		description,
		category: "operator",
	}));
}

export function createMicrofrontendCatalog(): ChatCatalog {
	const entries = () => catalogEntries();
	let selectionAtTurn = activeSelection();

	return {
		// The list is the answer to "which one", so it travels as words the steps
		// can use, not as an opaque blob.
		focus: () =>
			focusItems().map((item) => ({
				key: focusKey(item.ref),
				type: item.ref.type,
				label: item.label,
			})),
		turnContext: () => {
			const current = activeSelection();
			selectionAtTurn = current;
			if (!current) return undefined;
			return {
				activeSelection: {
					type: current.ref.type,
					selection: current.ref.selection,
				},
			};
		},
		catalog: {
			search: (query, limit) => searchOperatorCatalog(query, limit),
			listCategories: categories,
			listModules: modules,
			meta: catalogEntry,
			invoke: (id, params) => {
				// The identifier of the thing being worked on is not something to ask
				// a model for: it has been known since the screen was opened. The
				// operator runtime already reads `references` and nobody filled it,
				// so a function aimed at what is in focus is pointed at it here.
				const entry = catalogEntry(id);
				const target = entry?.targetType;
				const reference =
					target && !("references" in params) ? focusedRef(target) : undefined;
				return invokeCatalogEntry(
					id,
					reference ? { ...params, references: [reference] } : params,
					"assistant",
					selectionAtTurn,
				);
			},
			load: async (id) => {
				const entry = catalogEntry(id);
				if (!entry?.targetType) return entry?.parameters;
				await loadObjectType(entry.targetType);
				const type = objectRegistry.type(entry.targetType);
				if (!type) {
					throw new Error(
						`[chat] Object type "${entry.targetType}" did not register after loading`,
					);
				}
				if (entry.operator !== "select" || !type.selection?.describe)
					return catalogEntry(id)?.parameters;
				// The descriptor is a live microservice capability. In development it
				// may change without a shell reload; production also benefits when a
				// service exposes tenant-specific fields or presets.
				const definition = await loadSelectionDescriptor(type, true);
				if (!definition) {
					throw new Error(
						`[chat] Selection descriptor for "${entry.targetType}" is unavailable`,
					);
				}
				if (definition.filters.length === 0 && !definition.presets?.length) {
					throw new Error(
						`[chat] Selection descriptor for "${entry.targetType}" has no filter fields or presets`,
					);
				}
				return selectCommandSchema(definition) as FunctionParameters;
			},
		},
		context: {
			// Hot is the vocabulary itself; the resolved candidates are what search
			// and the category listing are for.
			getHot: () => briefs(operatorCatalogEntries()),
			listCategories: categories,
			listByCategory: (category) =>
				briefs(category === "operator" ? entries() : []),
			search: (query, limit) => briefs(searchOperatorCatalog(query, limit)),
		},
		label,
		onChange: (republish) => {
			void microfrontendRegistered.watch(republish);
			void microfrontendDeclared.watch(republish);
			void $activeLocale.watch(republish);
			onOperationAuthorizationChanged(republish);
		},
		diagnostics: {
			all: entries,
			meta: catalogEntry,
			loaded: (id) => Boolean(catalogEntry(id)),
			listCategories: categories,
			listByCategory: (category) =>
				briefs(category === "operator" ? entries() : []),
			listUserVisible: () => briefs(entries()),
			search: (query) => briefs(searchOperatorCatalog(query)),
			invoke: (id, params) => invokeCatalogEntry(id, params, "user"),
		},
	};
}
