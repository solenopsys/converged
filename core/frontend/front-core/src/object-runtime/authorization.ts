export type RuntimeSessionKind = "guest" | "account" | "unknown";

export type OperationAuthorizationController = {
	snapshot(): { session: RuntimeSessionKind };
	ensureSession(): Promise<unknown>;
	authenticate(): Promise<unknown>;
	can(capability: string): boolean;
	subscribe?(listener: () => void): () => void;
};

export class OperationAuthorizationError extends Error {
	constructor(
		readonly code:
			| "authentication_required"
			| "forbidden"
			| "authorization_unavailable",
		message: string,
	) {
		super(message);
		this.name = "OperationAuthorizationError";
	}
}

let controller: OperationAuthorizationController | null = null;
let unsubscribe: (() => void) | undefined;
const listeners = new Set<() => void>();

export function setOperationAuthorizationController(
	next: OperationAuthorizationController | null,
): void {
	unsubscribe?.();
	controller = next;
	unsubscribe = controller?.subscribe?.(() => {
		for (const listener of listeners) listener();
	});
	for (const listener of listeners) listener();
}

export function onOperationAuthorizationChanged(
	listener: () => void,
): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function canExecuteOperation(operation: {
	access?: "public" | "user";
	capability?: string;
}): boolean {
	if (operation.access === "public") return true;
	if (controller?.snapshot().session !== "account") return false;
	return !operation.capability || controller.can(operation.capability);
}

/** Whether a command-panel entry may be shown in the current browser session. */
export function canDiscover(item: {
	access?: "public" | "user";
	capability?: string;
}): boolean {
	return canExecuteOperation(item);
}

export async function authorizeOperation(operation: {
	id: string;
	access?: "public" | "user";
	capability?: string;
}): Promise<void> {
	if (operation.access === "public") return;
	if (!controller) {
		throw new OperationAuthorizationError(
			"authorization_unavailable",
			`Authorization is not configured for ${operation.id}`,
		);
	}
	await controller.ensureSession();
	if (!operation.capability && controller.snapshot().session === "account")
		return;
	if (operation.capability && controller.can(operation.capability)) return;
	if (controller.snapshot().session === "guest") {
		await controller.authenticate();
		throw new OperationAuthorizationError(
			"authentication_required",
			`Authentication is required for ${operation.id}`,
		);
	}
	throw new OperationAuthorizationError(
		"forbidden",
		`Permission ${operation.capability} is required for ${operation.id}`,
	);
}

/** Authorizes a generic object command before it presents the object's view. */
export async function authorizeObjectType(type: {
	id: string;
	access?: "public" | "user";
	capability?: string;
}): Promise<void> {
	return authorizeOperation(type);
}
