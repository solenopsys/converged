import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import { authorizeOperation } from "./authorization";
import { objectRegistry } from "./registry";
import { objectResolver } from "./resolver";
import type {
	DomainRef,
	ExecuteOperationRequest,
	MicrofrontendDefinition,
	PresentedReference,
	PresentReferenceOptions,
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
export const referencePresented = domain.createEvent<PresentedReference>(
	"REFERENCE_PRESENTED",
);

let loader: ModuleLoader | null = null;

export function setMicrofrontendLoader(next: ModuleLoader): void {
	loader = next;
}

async function ensureLoaded(owner: string | undefined): Promise<void> {
	if (owner && loader) await loader(owner);
}

export function registerMicrofrontend(
	definition: MicrofrontendDefinition,
): void {
	objectRegistry.register(definition.id, definition);
}

export async function presentReference(
	ref: DomainRef,
	options: PresentReferenceOptions = {},
): Promise<void> {
	let view = objectResolver.resolveView(ref, options.viewId);
	if (!view) {
		await ensureLoaded(objectRegistry.ownerForType(ref.type));
		view = objectResolver.resolveView(ref, options.viewId);
	}
	if (!view)
		throw new Error(`[object-runtime] No view for ${ref.kind}<${ref.type}>`);
	if (!view.component) {
		await ensureLoaded(objectRegistry.ownerForView(view.id));
		view = objectResolver.resolveView(ref, options.viewId);
	}
	if (!view?.component) {
		throw new Error(
			`[object-runtime] View did not register a component: ${options.viewId ?? ref.type}`,
		);
	}
	referencePresented({ ref, view, options });
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
			present: presentReference,
		});
		if (
			(operation.presentOutput || operation.operator === "create") &&
			isDomainRef(result)
		)
			await presentReference(result);
		operationExecutionSucceeded({ request, result });
		return result;
	} catch (error) {
		operationExecutionFailed({ request, error });
		throw error;
	}
}
