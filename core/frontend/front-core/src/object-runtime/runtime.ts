import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import { authorizeOperation } from "./authorization";
import { attachToFocus, focusItems } from "./focus";
import { objectRegistry } from "./registry";
import { objectResolver } from "./resolver";
import {
	type DomainRef,
	type ExecuteOperationRequest,
	type SurfaceDefinition,
	NEW_OBJECT_ID,
	type ObjectChange,
	type ObjectRef,
	type PresentedReference,
	type PresentReferenceOptions,
} from "./types";

type ModuleLoader = (moduleName: string) => Promise<void>;

const domain = createDomain("object-runtime");
createDomainLogger(domain);

export const operationExecutionStarted =
	domain.createEvent<ExecuteOperationRequest>("OPERATION_EXECUTION_STARTED");
export const operationExecutionSucceeded = domain.createEvent<{
	request: ExecuteOperationRequest;
	result: unknown;
}>("OPERATION_EXECUTION_SUCCEEDED");
export const operationExecutionFailed = domain.createEvent<{
	request: ExecuteOperationRequest;
	error: unknown;
}>("OPERATION_EXECUTION_FAILED");
export const objectChanged = domain.createEvent<ObjectChange>("OBJECT_CHANGED");
export const objectRefreshRequested = domain.createEvent<ObjectRef>(
	"OBJECT_REFRESH_REQUESTED",
);
export const objectRevisionKey = (ref: ObjectRef): string =>
	`${ref.type}#${ref.id}`;
const bumpObjectRevision = (
	revisions: Record<string, number>,
	ref: ObjectRef,
): Record<string, number> => {
	const key = objectRevisionKey(ref);
	return { ...revisions, [key]: (revisions[key] ?? 0) + 1 };
};
export const $objectRevisions = domain
	.createStore<Record<string, number>>({}, { name: "OBJECT_REVISIONS" })
	.on(objectChanged, (revisions, { ref }) => bumpObjectRevision(revisions, ref))
	.on(objectRefreshRequested, bumpObjectRevision);
export const referencePresented = domain.createEvent<PresentedReference>(
	"REFERENCE_PRESENTED",
);

const objectSnapshots = new Map<string, Record<string, unknown>>();

const snapshotKey = (type: string, id: string): string => `${type}:${id}`;

/** Retains row data for a detail view opened from a list projection. */
export function rememberObjectSnapshot(
	type: string,
	id: string | number,
	data: Record<string, unknown>,
): void {
	objectSnapshots.set(snapshotKey(type, String(id)), data);
}

function withObjectSnapshot(ref: DomainRef): DomainRef {
	if (ref.kind !== "object" || ref.data) return ref;
	const data = objectSnapshots.get(snapshotKey(ref.type, ref.id));
	return data ? { ...ref, data } : ref;
}

let loader: ModuleLoader | null = null;

/** Revalidate live views after a chat turn may have changed focused objects. */
export function refreshFocusedObjects(): void {
	for (const { ref } of focusItems()) {
		if (ref.kind === "object") objectRefreshRequested(ref);
	}
}

export function setSurfaceLoader(next: ModuleLoader): void {
	loader = next;
}

async function ensureLoaded(owner: string | undefined): Promise<void> {
	if (owner && loader) await loader(owner);
}

export async function loadObjectType(type: string): Promise<void> {
	await ensureLoaded(objectRegistry.ownerForType(type));
}

export function registerSurface(
	definition: SurfaceDefinition,
): void {
	objectRegistry.register(definition.id, definition);
}

export async function presentReference(
	ref: DomainRef,
	options: PresentReferenceOptions = {},
): Promise<void> {
	const presentedRef = withObjectSnapshot(ref);
	let view = objectResolver.resolveView(presentedRef, options.viewId);
	if (!view) {
		await ensureLoaded(objectRegistry.ownerForType(presentedRef.type));
		view = objectResolver.resolveView(presentedRef, options.viewId);
	}
	if (!view)
		throw new Error(`[object-runtime] No view for ${ref.kind}<${ref.type}>`);
	if (!view.component) {
		await ensureLoaded(objectRegistry.ownerForView(view.id));
		view = objectResolver.resolveView(presentedRef, options.viewId);
	}
	if (!view?.component) {
		throw new Error(
			`[object-runtime] View did not register a component: ${options.viewId ?? ref.type}`,
		);
	}
	// Opening something is the moment work on it starts, whoever opened it. This
	// is the only signal that does not have to be remembered by every module and
	// does not lie when a second tab is opened. A `new` object is not a thing yet
	// — it becomes one when the create returns a real id, and that presents again.
	if (!(presentedRef.kind === "object" && presentedRef.id === NEW_OBJECT_ID)) {
		attachToFocus(
			presentedRef,
			presentedRef.title ??
				objectRegistry.type(presentedRef.type)?.label ??
				presentedRef.type,
		);
	}
	referencePresented({ ref: presentedRef, view, options });
}

function isDomainRef(value: unknown): value is DomainRef {
	if (!value || typeof value !== "object") return false;
	const ref = value as Partial<DomainRef>;
	return (
		(ref.kind === "object" || ref.kind === "set") &&
		typeof ref.type === "string"
	);
}

export async function executeOperation(
	request: ExecuteOperationRequest,
): Promise<unknown> {
	let operation = objectRegistry.operation(request.operationId);
	if (!operation)
		throw new Error(
			`[object-runtime] Unknown operation: ${request.operationId}`,
		);
	if (!operation.invoke) {
		await ensureLoaded(operation.owner);
		operation = objectRegistry.operation(request.operationId);
	}
	if (!operation?.invoke) {
		throw new Error(
			`[object-runtime] Operation did not register: ${request.operationId}`,
		);
	}

	operationExecutionStarted(request);
	try {
		await authorizeOperation(operation);
		const result = await operation.invoke({
			references: request.references ?? [],
			params: request.params ?? {},
			changed: (ref, payload) =>
				objectChanged({
					ref,
					operationId: operation.id,
					...(payload === undefined ? {} : { payload }),
					...(request.source ? { source: request.source } : {}),
				}),
			present: (ref, options) =>
				presentReference(ref, {
					...options,
					...(request.source ? { source: request.source } : {}),
				}),
		});
		if (
			(operation.presentOutput || operation.operator === "create") &&
			isDomainRef(result)
		)
			await presentReference(result, {
				...(request.source ? { source: request.source } : {}),
			});
		operationExecutionSucceeded({ request, result });
		return result;
	} catch (error) {
		operationExecutionFailed({ request, error });
		throw error;
	}
}
