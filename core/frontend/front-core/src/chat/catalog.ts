import {
	authorizeObjectType,
	availableSurfaces,
	catalogEntries,
	catalogEntry,
	focusedRef,
	focusItems,
	focusKey,
	invokeCatalogEntry,
	loadObjectType,
	type OperatorCatalogEntry,
	objectRegistry,
	onOperationAuthorizationChanged,
	onSurfacesChanged,
	operatorCatalogEntries,
	searchOperatorCatalog,
} from "front-core/object-runtime";
import { $activeLocale } from "../i18n";
import { loadSelectionDescriptor } from "../select/descriptor";
import { activeSelection } from "../select/runtime";
import { selectCommandSchema } from "../select/schema";
import { workspacePosition, workspaceSubtabs } from "../workspace-view";
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
 * The catalog's first level: the surfaces the interface offers. This is what
 * the first step picks from, so it is the configured list (§2.4) rather than a
 * tally of the function catalog — a surface whose functions are all currently
 * unavailable is still a tab on screen, and a model that cannot name it cannot
 * take the user there.
 */
function modules() {
	const counts = new Map<string, number>();
	for (const entry of catalogEntries()) {
		if (!entry.module) continue;
		counts.set(entry.module, (counts.get(entry.module) ?? 0) + 1);
	}
	return availableSurfaces().map((surface) => ({
		id: surface.id,
		label: surface.label,
		count: counts.get(surface.id) ?? 0,
		description: surface.purpose,
	}));
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

export function createSurfaceCatalog(): ChatCatalog {
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
		// Where the user is standing. Unlike `focus` this is one place, and it is
		// what lets the first two steps be skipped when the request continues it.
		position: workspacePosition,
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
			subtabs: workspaceSubtabs,
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
				// Asking the service to describe its selection is already a call
				// against it, so it is subject to the same rights as using it. This
				// is where a guest gets the login prompt: without it the descriptor
				// comes back "missing r permission", the step throws, and the raw
				// service error is what the user is shown instead of a way in.
				await authorizeObjectType(type);
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
			onSurfacesChanged(republish);
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
