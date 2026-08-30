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
export type CategoryId = string;
export type ObjectTypeId = string;
export type ViewId = string;
export type OperationId = string;

export type CategoryDefinition = {
	id: CategoryId;
	label: string;
	parent?: CategoryId;
	description?: string;
};

export const CORE_CATEGORIES = [
	{ id: "core.entity", label: "Entity" },
	{ id: "core.content", label: "Content", parent: "core.entity" },
	{ id: "core.business", label: "Business", parent: "core.entity" },
	{ id: "core.communication", label: "Communication", parent: "core.entity" },
	{ id: "core.automation", label: "Automation", parent: "core.entity" },
	{ id: "core.security", label: "Security", parent: "core.entity" },
	{ id: "core.statistic", label: "Statistic", parent: "core.entity" },
	{ id: "core.financial", label: "Financial", parent: "core.statistic" },
	{ id: "core.selectable", label: "Selectable" },
	{ id: "core.creatable", label: "Creatable" },
	{ id: "core.editable", label: "Editable" },
	{ id: "core.executable", label: "Executable" },
] as const satisfies readonly CategoryDefinition[];

export type ObjectTypeDefinition = {
	id: ObjectTypeId;
	label: string;
	pluralLabel?: string;
	description?: string;
	categories: CategoryId[];
	idField?: string;
};

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
	query: Record<string, unknown>;
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
	categories?: CategoryId[];
};

export type ViewRuntimeProps = {
	ref: DomainRef;
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
	access?: "public";
	capability?: string;
	priority?: number;
	presentOutput?: boolean;
	invoke?: (context: OperationContext) => unknown | Promise<unknown>;
};

export type MicrofrontendDefinition = {
	id: string;
	categories?: CategoryDefinition[];
	types: ObjectTypeDefinition[];
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
	categories?: CategoryId[];
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
	source?: "assistant" | "user";
};

export type PresentReferenceOptions = {
	viewId?: ViewId;
	key?: string;
	title?: string;
	pinned?: boolean;
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
