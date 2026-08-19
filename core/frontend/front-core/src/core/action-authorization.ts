import type { Action, ActionMeta } from "./types";

type SessionKind = "guest" | "account" | "unknown";

/** Structural contract: front-core does not own the auth controller. */
export type ActionAuthorizationController = {
	snapshot(): { session: SessionKind };
	ensureSession(): Promise<unknown>;
	authenticate(): Promise<unknown>;
	can(capability: string): boolean;
	subscribe?(listener: () => void): () => void;
};

export type ActionAuthorizationErrorCode =
	| "authentication_required"
	| "forbidden"
	| "authorization_unavailable";

export class ActionAuthorizationError extends Error {
	constructor(readonly code: ActionAuthorizationErrorCode, message: string) {
		super(message);
		this.name = "ActionAuthorizationError";
	}
}

let controller: ActionAuthorizationController | null = null;
let unsubscribe: (() => void) | undefined;
const listeners = new Set<() => void>();

/** The host composition layer supplies its UI, widget, or CLI auth controller. */
export function setActionAuthorizationController(
	next: ActionAuthorizationController | null,
): void {
	unsubscribe?.();
	controller = next;
	unsubscribe = controller?.subscribe?.(() => {
		for (const listener of listeners) listener();
	});
	for (const listener of listeners) listener();
}

export function onActionAuthorizationChanged(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function canRunAction(action: Pick<ActionMeta, "access" | "capability">): boolean {
	if (action.access === "public") return true;
	if (!controller || controller.snapshot().session !== "account") return false;
	return !action.capability || controller.can(action.capability);
}

export async function authorizeAction(action: Action<unknown>): Promise<void> {
	if (action.access === "public") return;
	if (!controller) {
		throw new ActionAuthorizationError(
			"authorization_unavailable",
			`Authorization is not configured for ${action.id}`,
		);
	}

	await controller.ensureSession();
	if (!action.capability && controller.snapshot().session === "account") return;
	if (action.capability && controller.can(action.capability)) return;
	if (controller.snapshot().session === "guest") {
		await controller.authenticate();
		throw new ActionAuthorizationError(
			"authentication_required",
			`Authentication is required for ${action.id}`,
		);
	}

	throw new ActionAuthorizationError(
		"forbidden",
		`Permission ${action.capability} is required for ${action.id}`,
	);
}
