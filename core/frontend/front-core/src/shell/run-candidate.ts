import {
	authorizeOperation,
	type DomainRef,
	executeOperation,
	invokeOperator,
	NEW_OBJECT_ID,
	type Operator,
	objectRef,
	presentReference,
	type ResolutionCandidate,
} from "front-core/object-runtime";

/** The id an object carries while the screen that builds it is still open. */
export const NEW = NEW_OBJECT_ID;

/**
 * What a click on a resolved candidate does. It lives here, and not inside the
 * shell's JSX, because the first case of it is a rule about the runtime rather
 * than a detail of the panel.
 *
 * An object is not a couple of fields — it can be arbitrarily deep, and only
 * the microfrontend that owns the type knows how it is built. So the shell
 * never constructs one from a schema: an operation that composes its object
 * names the screen that does it, and that screen opens in the workspace like
 * any other view. An operation without one is just run — that is the whole of
 * "start a call".
 */
export function runCandidate(
	operator: Operator,
	candidate: ResolutionCandidate,
	references: DomainRef[] = [],
): Promise<unknown> {
	const operation = candidate.operation;
	// References are a composition the user already made, so an operation that
	// received one is run, not re-composed from an empty screen.
	if (operation?.view && candidate.targetType && references.length === 0) {
		return authorizeOperation(operation).then(() =>
			presentReference(objectRef(candidate.targetType, NEW), {
				viewId: operation.view,
			}),
		);
	}
	if (candidate.kind === "operation") {
		return executeOperation({
			operationId: candidate.id,
			references,
			source: "user",
		});
	}
	return invokeOperator(
		operator,
		{ targetType: candidate.targetType, references },
		"user",
	);
}
