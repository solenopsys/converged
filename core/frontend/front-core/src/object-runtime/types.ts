import type { SelectionDescriptor, SelectionPreset } from "back-core";
import type { ComponentType } from "preact";

export const OPERATORS = [
	"show",
	"select",
	"open",
	"create",
	"add",
	"save",
	"execute",
] as const;

export type Operator = (typeof OPERATORS)[number];
export type ObjectTypeId = string;
export type ViewId = string;
export type OperationId = string;

/**
 * Categories are a closed vocabulary, not records contributed by individual
 * microfrontends. A type either declares a category explicitly or it does not.
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

export type ObjectDefinition = {
	id: ObjectTypeId;
	label: string;
	pluralLabel?: string;
	description?: string;
	categories?: readonly CategoryId[];
	idField?: string;
	/** Controls whether generic commands may advertise this type to a guest. */
	access?: DiscoveryAccess;
	/** Runtime predicate for catalog and command discovery. */
	discover?: () => boolean;
	/** Optional existing NRPC permission required to advertise this type. */
	capability?: string;
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
	// Object-specific capabilities are owned by the microfrontend. The runtime
	// indexes identity and categories; it does not impose a generic UI schema.
	[extension: string]: unknown;
};

export type ObjectTypeDefinition = ObjectDefinition;

export type ObjectRef = {
	kind: "object";
	type: ObjectTypeId;
	id: string;
	title?: string;
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
	// Components belong to independently built microfrontends and carry their own prop types.
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
};

export type OperationDefinition = {
	id: OperationId;
	operator: Operator;
	target?: ObjectTypeId;
	label: string;
	description?: string;
	inputs?: OperationInput[];
	output?: TypeExpression;
	/**
	 * The screen that builds the object, for operators that construct one. An
	 * object is not a list of fields — only the microfrontend knows how deep it
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

export type MicrofrontendDefinition = {
	id: string;
	types: readonly ObjectDefinition[];
	views: ViewDefinition[];
	operations: OperationDefinition[];
	// biome-ignore lint/suspicious/noConfusingVoidType: setup may optionally return cleanup
	setup?: () => void | (() => void);
};

export type MicrofrontendManifest = Omit<MicrofrontendDefinition, "setup"> & {
	views: Array<Omit<ViewDefinition, "component" | "props">>;
	operations: Array<Omit<OperationDefinition, "invoke">>;
};

export type ObjectIndexModule = {
	module: string;
	manifest: MicrofrontendManifest;
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

export function defineMicrofrontend(
	definition: MicrofrontendDefinition,
): MicrofrontendDefinition {
	return definition;
}

/** The id an object carries while the screen that builds it is still open. */
export const NEW_OBJECT_ID = "new";

export function objectRef(
	type: ObjectTypeId,
	id: string | number,
	options: Pick<ObjectRef, "title"> = {},
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
