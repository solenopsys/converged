import type { SelectionDescriptor, SelectionPreset } from "back-core";
import type { ComponentType } from "preact";
import type { SurfaceLlmCatalog } from "../llm-catalog";
import type { HeaderAction } from "../components/HeaderPanel";
import type { TableFilterConfig } from "../table/filter-header";
import type { InfiniteTableStore } from "../table/infinite-table-store";
import type { ColumnConfig } from "../table/types";

export const OPERATORS = [
	"show",
	"select",
	"open",
	"create",
	"add",
	"remove",
	"save",
	"delete",
	"execute",
] as const;

export type Operator = (typeof OPERATORS)[number];
export type ObjectTypeId = string;
export type ViewId = string;
export type OperationId = string;

/**
 * Categories are a closed vocabulary, not records contributed by individual
 * surfaces. A type either declares a category explicitly or it does not.
 */
export const Category = {
	Entity: "core.entity",
	Content: "core.content",
	Business: "core.business",
	Communication: "core.communication",
	Automation: "core.automation",
	Security: "core.security",
	Statistic: "core.statistic",
	Financial: "core.financial",
	Selectable: "core.selectable",
	Creatable: "core.creatable",
	Editable: "core.editable",
	Executable: "core.executable",
} as const;

export type CategoryId = (typeof Category)[keyof typeof Category];

/**
 * Mirrors the browser-relevant part of NRPC @Access: public surfaces are the
 * exception; every other surface belongs to an authenticated user.
 */
export type DiscoveryAccess = "public" | "user";

/** Bento sizing hint: "lg" spans a 2x2 tile, everything else a single cell. */
export type StatisticWidgetSize = "sm" | "lg";

/**
 * A "summary" is the service's readout while its section is collapsed: a few
 * headline numbers and one trend line, not a chart. At most one per
 * surface; everything else is a "block" inside the opened section.
 */
export type StatisticRole = "summary" | "block";

export type StatisticDefinition = {
	// The chart belongs to an independently built surface and carries its
	// own prop types; the runtime only mounts it.
	// biome-ignore lint/suspicious/noExplicitAny: mounted, never inspected
	component?: ComponentType<any>;
	props?: Record<string, unknown>;
	size?: StatisticWidgetSize;
	/** Defaults to "block". */
	role?: StatisticRole;
	/** Actions declared by the owning SF; the dashboard invokes them itself. */
	actions?: {
		title?: string;
		metrics?: Record<string, string>;
	};
};

/** The complete configuration for an object's default infinite-list projection. */
export type InfinityDefinition<TData extends object = Record<string, unknown>> = {
	/** Stable identity used by the generic table and persisted UI state. */
	tableId?: string;
	title?: string;
	columns: readonly ColumnConfig<TData>[];
	filters?: readonly (TableFilterConfig & { operator?: string })[];
	/** An existing domain store, when the projection already owns request lifecycle. */
	store?: InfiniteTableStore<TData>;
	/** Declarative source for projections that do not need a domain-level store. */
	load?: (params: Record<string, unknown>) => Promise<unknown>;
	rowRef?: (row: TData) => ObjectRef;
	actions?: readonly HeaderAction[];
	mobile?: {
		title: string;
		subtitle?: string;
		badge?: string;
		image?: string;
	};
};


export type ObjectDefinition = {
	id: ObjectTypeId;
	label: string;
	/** Message keys in the owning surface; static text remains the fallback. */
	labelKey?: string;
	pluralLabel?: string;
	pluralLabelKey?: string;
	description?: string;
	descriptionKey?: string;
	categories?: readonly CategoryId[];
	idField?: string;
	/** Controls whether generic commands may advertise this type to a guest. */
	access?: DiscoveryAccess;
	/** Runtime predicate for catalog and command discovery. */
	discover?: () => boolean;
	/** Optional existing NRPC permission required to advertise this type. */
	capability?: string;
	/**
	 * A single statistic block: one chart or one indicator, not a page of them.
	 * The dashboard reads this straight from the catalog, so a surface
	 * publishes its charts by declaring types — it does not own a dashboard
	 * screen anymore. `component` survives only in a loaded module: the build
	 * index is JSON, so it arrives undefined until the owner is imported.
	 */
	statistic?: StatisticDefinition;
	infinity?: InfinityDefinition;
	/** Serializable filter capability used by select, the LLM and collection views. */
	selection?: {
		filters: readonly {
			id: string;
			label: string;
			description?: string;
			valueType: "string" | "number" | "boolean" | "date";
			operators: readonly string[];
			options?: readonly {
				id: string | number | boolean | null;
				label: string;
				aliases?: string[];
			}[];
			control?: "text" | "select" | "multi-select" | "boolean" | "date-range";
		}[];
		load?: (params: any) => Promise<unknown>;
		inspect?: (
			filter?: any,
			presets?: SelectionPreset[],
		) => Promise<{
			totalCount: number;
			facets?: Record<string, Record<string, number>>;
		}>;
		describe?: () => Promise<SelectionDescriptor>;
	};
	// Object-specific capabilities are owned by the surface. The runtime
	// indexes identity and categories; it does not impose a generic UI schema.
	[extension: string]: unknown;
};

export type ObjectTypeDefinition = ObjectDefinition;

export type ObjectRef = {
	kind: "object";
	type: ObjectTypeId;
	id: string;
	title?: string;
	/** Row data available when a record is opened from a list projection. */
	data?: Record<string, unknown>;
};

export type IdSelection = {
	kind: "ids";
	ids: string[];
};

export type QuerySelection = {
	kind: "query";
	/** Canonical, serializable predicate describing members of this set. */
	filter?: Record<string, unknown>;
	/** Opaque server-owned predicates combined with filter through AND. */
	presets?: SelectionPreset[];
};

export type SetSelection = IdSelection | QuerySelection;

export type SetRef = {
	kind: "set";
	type: ObjectTypeId;
	selection: SetSelection;
	title?: string;
};

export type DomainRef = ObjectRef | SetRef;

export type RefKind = DomainRef["kind"];

export type TypeExpression = {
	kind: RefKind;
	type?: ObjectTypeId;
	categories?: readonly CategoryId[];
};

export type ViewRuntimeProps = {
	/**
	 * Domain identity supplied to a mounted view. `ref` is reserved by Preact
	 * for element references and is therefore never delivered as a component prop.
	 */
	reference: DomainRef;
};

export type ViewDefinition = {
	id: ViewId;
	accepts: TypeExpression;
	label?: string;
	priority?: number;
	// Components belong to independently built surfaces and carry their own prop types.
	// biome-ignore lint/suspicious/noExplicitAny: the runtime only stores and mounts them
	component?: ComponentType<any>;
	props?: (ref: DomainRef) => Record<string, unknown>;
};

export type OperationInput = {
	name: string;
	accepts: TypeExpression;
	required?: boolean;
	description?: string;
};

export type OperationParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

export type OperationContext = {
	references: DomainRef[];
	params: Record<string, unknown>;
	present: (ref: DomainRef, options?: PresentReferenceOptions) => Promise<void>;
	/** Publish a persisted object mutation to every mounted view of that object. */
	changed: (ref: ObjectRef, payload?: unknown) => void;
};

export type ObjectChange = {
	ref: ObjectRef;
	operationId: OperationId;
	payload?: unknown;
	source?: PresentationSource;
};

export type OperationDefinition = {
	id: OperationId;
	operator: Operator;
	target?: ObjectTypeId;
	label: string;
	/** Message keys in the owning surface; static text remains the fallback. */
	labelKey?: string;
	description?: string;
	descriptionKey?: string;
	inputs?: OperationInput[];
	output?: TypeExpression;
	/**
	 * The screen that builds the object, for operators that construct one. An
	 * object is not a list of fields — only the surface knows how deep it
	 * goes — so `create` from the UI opens this view instead of anything derived
	 * from `parameters`. Without it the operation is simply executed, which is
	 * right for a create that needs no composing (starting a call, say).
	 * `parameters` stays what the assistant fills in to call the operation
	 * directly; it is not a form description.
	 */
	view?: ViewId;
	parameters?: OperationParameters;
	access?: DiscoveryAccess;
	/** Runtime predicate for catalog and command discovery. */
	discover?: () => boolean;
	capability?: string;
	priority?: number;
	presentOutput?: boolean;
	invoke?: (context: OperationContext) => unknown | Promise<unknown>;
};

/**
 * A surface is a tab: one place in the interface that gathers functionality by
 * meaning. What it calls itself and what it is for are therefore part of the
 * definition, not something to derive from the id — `sf-sales` reading as
 * "Sales" is a guess that happens to work, and `purpose` has no such fallback
 * at all (module descriptions used to be every action description joined by
 * "; ", which is a paragraph where one line was needed).
 */
export type SurfaceDefinition = {
	id: string;
	/** Tab title. */
	label: string;
	/** Message key in this surface's own locales; `label` stays the fallback. */
	labelKey?: string;
	/**
	 * One line: what this surface is for. This is what the first orchestrator
	 * step reads to pick a surface in a single pass, so it has to separate this
	 * surface from its neighbours — not advertise it. Name the things it works
	 * on, in the words a user would use.
	 */
	purpose: string;
	purposeKey?: string;
	/**
	 * Owns operations but is not a place: the shell's own controls register this
	 * way, so they resolve like anything else without becoming a tab nobody
	 * asked for.
	 */
	hidden?: boolean;
	types: readonly ObjectDefinition[];
	views: ViewDefinition[];
	operations: OperationDefinition[];
	// biome-ignore lint/suspicious/noConfusingVoidType: setup may optionally return cleanup
	setup?: () => void | (() => void);
};

export type SurfaceManifest = Omit<SurfaceDefinition, "setup"> & {
	views: Array<Omit<ViewDefinition, "component" | "props">>;
	operations: Array<Omit<OperationDefinition, "invoke">>;
};

export type ObjectIndexModule = {
	module: string;
	manifest: SurfaceManifest;
	/** LLM metadata shipped with the lazy module and available before it loads. */
	llm?: SurfaceLlmCatalog;
};

export type ObjectIndexFile = {
	modules: Record<string, ObjectIndexModule>;
};

export type ResolveContext = {
	references?: DomainRef[];
	targetType?: ObjectTypeId;
	categories?: readonly CategoryId[];
	/** The command panel hides targets the current browser session cannot run. */
	discovery?: "panel";
};

export type ResolutionCandidate = {
	id: string;
	kind: "type" | "operation";
	operator: Operator;
	targetType?: ObjectTypeId;
	label: string;
	description?: string;
	owner?: string;
	score: number;
	operation?: OperationDefinition;
};

export type ExecuteOperationRequest = {
	operationId: OperationId;
	references?: DomainRef[];
	params?: Record<string, unknown>;
	source?: PresentationSource;
};

/** Who initiated a presentation or operation in the workspace. */
export type PresentationSource = "assistant" | "user";

export type PresentReferenceOptions = {
	viewId?: ViewId;
	key?: string;
	title?: string;
	pinned?: boolean;
	source?: PresentationSource;
};

export type PresentedReference = {
	ref: DomainRef;
	view: ViewDefinition;
	options: PresentReferenceOptions;
};

export function defineSurface(
	definition: SurfaceDefinition,
): SurfaceDefinition {
	return definition;
}

/** The id an object carries while the screen that builds it is still open. */
export const NEW_OBJECT_ID = "new";

export function objectRef(
	type: ObjectTypeId,
	id: string | number,
	options: Pick<ObjectRef, "title" | "data"> = {},
): ObjectRef {
	return { kind: "object", type, id: String(id), ...options };
}

export function setRef(
	type: ObjectTypeId,
	selection: SetSelection,
	options: Pick<SetRef, "title"> = {},
): SetRef {
	return { kind: "set", type, selection, ...options };
}

export function objectOf(type?: ObjectTypeId): TypeExpression {
	return { kind: "object", ...(type ? { type } : {}) };
}

export function setOf(type?: ObjectTypeId): TypeExpression {
	return { kind: "set", ...(type ? { type } : {}) };
}
