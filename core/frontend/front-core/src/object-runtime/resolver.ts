import { type ObjectRegistry, objectRegistry } from "./registry";
import type {
	DomainRef,
	OperationDefinition,
	Operator,
	ResolutionCandidate,
	ResolveContext,
	TypeExpression,
	ViewDefinition,
} from "./types";

function expressionMatches(
	expression: TypeExpression,
	ref: DomainRef,
	registry: ObjectRegistry,
): boolean {
	if (expression.kind !== ref.kind) return false;
	if (expression.type && expression.type !== ref.type) return false;
	return (expression.categories ?? []).every((category) =>
		registry.hasCategory(ref.type, category),
	);
}

function operationMatches(
	operation: OperationDefinition,
	references: DomainRef[],
	registry: ObjectRegistry,
): boolean {
	return (operation.inputs ?? []).every(
		(input) =>
			input.required === false ||
			references.some((ref) => expressionMatches(input.accepts, ref, registry)),
	);
}

function operationScore(
	operation: OperationDefinition,
	references: DomainRef[],
): number {
	let score = operation.priority ?? 0;
	for (const input of operation.inputs ?? []) {
		const exact = references.some(
			(ref) =>
				ref.kind === input.accepts.kind &&
				Boolean(input.accepts.type) &&
				ref.type === input.accepts.type,
		);
		score += exact ? 20 : 5;
	}
	return score;
}

export class ObjectResolver {
	constructor(private readonly registry: ObjectRegistry) {}

	resolve(
		operator: Operator,
		context: ResolveContext = {},
	): ResolutionCandidate[] {
		const references = context.references ?? [];
		const requestedCategories = context.categories ?? [];
		const operations = this.registry
			.allOperations()
			.filter((operation) => operation.operator === operator)
			.filter(
				(operation) =>
					operator !== "create" ||
					Boolean(
						operation.target &&
							this.registry
								.allViews()
								.some(
									(view) =>
										view.accepts.kind === "object" &&
										view.accepts.type === operation.target,
								),
					),
			)
			.filter(
				(operation) =>
					!context.targetType || operation.target === context.targetType,
			)
			.filter((operation) =>
				operationMatches(operation, references, this.registry),
			)
			.filter((operation) => {
				const target = operation.target;
				return (
					requestedCategories.length === 0 ||
					Boolean(
						target &&
							requestedCategories.every((category) =>
								this.registry.hasCategory(target, category),
							),
					)
				);
			})
			.map<ResolutionCandidate>((operation) => ({
				id: operation.id,
				kind: "operation",
				operator,
				targetType: operation.target,
				label:
					operator === "create" && operation.target
						? (this.registry.type(operation.target)?.label ?? operation.label)
						: operation.label,
				description: operation.description,
				owner: operation.owner,
				score: operationScore(operation, references),
				operation,
			}));

	const categoryForOperator =
		operator === "select"
			? "core.selectable"
			: operator === "create"
				? "core.creatable"
				: undefined;
	const includeTypes =
		operator === "show" || operator === "select" || operator === "open";
		const types = includeTypes
			? this.registry
					.allTypes()
					.filter(
						(type) =>
							operator !== "open" ||
							references.some(
								(ref) => ref.kind === "object" && ref.type === type.id,
							),
					)
					.filter(
						(type) => !context.targetType || type.id === context.targetType,
					)
					.filter(
						(type) =>
							!categoryForOperator ||
							this.registry.hasCategory(type.id, categoryForOperator),
					)
					.filter((type) =>
						requestedCategories.every((category) =>
							this.registry.hasCategory(type.id, category),
						),
					)
					.map<ResolutionCandidate>((type) => ({
						id: `${operator}:${type.id}`,
						kind: "type",
						operator,
						targetType: type.id,
						label:
							operator === "select"
								? (type.pluralLabel ?? type.label)
								: type.label,
						description: type.description,
						owner: type.owner,
						score: 0,
					}))
			: [];

		return [...operations, ...types].sort(
			(left, right) =>
				right.score - left.score || left.label.localeCompare(right.label),
		);
	}

	resolveView(ref: DomainRef, viewId?: string): ViewDefinition | undefined {
		if (viewId) {
			const view = this.registry.view(viewId);
			return view && expressionMatches(view.accepts, ref, this.registry)
				? view
				: undefined;
		}
		return this.registry
			.allViews()
			.filter((view) => expressionMatches(view.accepts, ref, this.registry))
			.sort(
				(left, right) =>
					(right.priority ?? 0) - (left.priority ?? 0) ||
					left.id.localeCompare(right.id),
			)[0];
	}
}

export const objectResolver = new ObjectResolver(objectRegistry);

export function resolve(
	operator: Operator,
	context?: ResolveContext,
): ResolutionCandidate[] {
	return objectResolver.resolve(operator, context);
}
