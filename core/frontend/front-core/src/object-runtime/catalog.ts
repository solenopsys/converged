import { selectionDefinition } from "../select/descriptor";
import type { ActiveSelectionContext } from "../select/runtime";
import { activeSelection } from "../select/runtime";
import { selectCommandSchema } from "../select/schema";
import { applySelectCommand } from "../select/selection";
import type { SelectCommand } from "../select/types";
import { authorizeObjectType } from "./authorization";
import { objectRegistry } from "./registry";
import { objectResolver } from "./resolver";
import { executeOperation, loadObjectType, presentReference } from "./runtime";
import {
	type CategoryId,
	type DomainRef,
	NEW_OBJECT_ID,
	OPERATORS,
	type Operator,
	objectRef,
	setRef,
} from "./types";

export type OperatorCatalogEntry = {
	id: string;
	operator: Operator;
	brief: string;
	description: string;
	category: "operator";
	priority: "primary" | "secondary";
	exposure: "user";
	/** Set on a resolved candidate: what this entry acts on. */
	targetType?: string;
	/** Set when the candidate is a domain operation rather than a type. */
	operationId?: string;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

const labels: Record<Operator, string> = {
	show: "Show objects",
	select: "Select objects",
	open: "Open object",
	create: "Create object",
	add: "Add to object",
	save: "Save object",
	execute: "Execute operation",
};

const verbs: Record<Operator, string> = {
	show: "Show",
	select: "Select",
	open: "Open",
	create: "Create",
	add: "Add to",
	save: "Save",
	execute: "Execute",
};

type OperatorTarget = { id: string; label: string };

/**
 * What the operator can actually be pointed at right now. The model never sees
 * the registry, so an operator with a free-form `targetType` is a coin flip:
 * it guesses "companies", the resolver knows `companies.company`, and the call
 * comes back as "nothing resolves". The resolver's own candidates are the
 * answer, so they travel with the operator as an enum.
 */
export function operatorTargets(operator: Operator): OperatorTarget[] {
	const targets = new Map<string, string>();
	if (operator === "open") {
		// `open` resolves against a concrete object, and there is none while the
		// catalog is being read; any type with an object view can be opened.
		for (const type of objectRegistry.allTypes()) {
			if (type.discover?.() === false) continue;
			if (objectResolver.resolveView(objectRef(type.id, "")))
				targets.set(type.id, type.label);
		}
	} else {
		for (const candidate of objectResolver.resolve(operator)) {
			if (candidate.targetType && !targets.has(candidate.targetType))
				targets.set(candidate.targetType, candidate.label);
		}
	}
	return [...targets].map(([id, label]) => ({ id, label }));
}

const targetList = (targets: OperatorTarget[]): string =>
	targets.map(({ id, label }) => `${label} (${id})`).join(", ");

const operatorParameters = (
	targets: OperatorTarget[],
	operator?: Operator,
) => ({
	type: "object" as const,
	properties: {
		targetType: {
			type: "string",
			description:
				targets.length > 0
					? `Canonical object type this operator acts on. Available: ${targetList(targets)}`
					: "Canonical object type selected by the resolver",
			...(targets.length > 0
				? { enum: targets.map((target) => target.id) }
				: {}),
		},
		id: { type: "string", description: "Object identifier for open/show" },
		ids: {
			type: "array",
			items: { type: "string" },
			description: "Explicit selected object identifiers",
		},
		query: { type: "object", description: "Collection query or filters" },
		filter: {
			type: "object",
			description: "Serializable filter for a selected object set",
		},
		categories: {
			type: "array",
			items: { type: "string" },
			description: "Core semantic categories",
		},
		params: {
			type: "object",
			description: "Parameters of the resolved domain operation",
		},
	},
	...(operator === "open" ? { required: ["targetType", "id"] } : {}),
});

export function operatorCatalogEntries(): OperatorCatalogEntry[] {
	return OPERATORS.map((operator) => ({
		id: `core.${operator}`,
		operator,
		brief: labels[operator],
		description: `${labels[operator]} through the typed object resolver`,
		category: "operator",
		priority: "primary",
		exposure: "user",
		parameters: operatorParameters(operatorTargets(operator), operator),
	}));
}

export function operatorCatalogEntry(
	id: string,
): OperatorCatalogEntry | undefined {
	return operatorCatalogEntries().find((entry) => entry.id === id);
}

const CANDIDATE = /^core\.([a-z]+):(.+)$/;
const FALLBACK_SELECTION_LIMIT = 6;

// The candidate fixes the target, so the operator's `targetType` is no longer
// the caller's to choose.
const candidateParameters = (
	targetType?: string,
	operator?: Operator,
): OperatorCatalogEntry["parameters"] => {
	const type = targetType ? objectRegistry.type(targetType) : undefined;
	const definition = selectionDefinition(type);
	if (operator === "select") {
		return selectCommandSchema(
			definition ?? { filters: [] },
		) as OperatorCatalogEntry["parameters"];
	}
	const { targetType: _fixed, ...properties } = operatorParameters(
		[],
		operator,
	).properties;
	return {
		type: "object",
		properties,
		...(operator === "open" ? { required: ["id"] } : {}),
	};
};

/**
 * The resolver's own output, published as catalog entries. Seven operators are
 * the whole vocabulary, but nothing in "Show objects" answers to "companies":
 * route and search rank words against what the catalog says about itself, so
 * the object the operator would act on has to be part of an entry, not hidden
 * one resolve() call away. These are derived on every read — they follow the
 * registry, they are not a second registry.
 */
export function operatorCandidateEntries(): OperatorCatalogEntry[] {
	// Two operations can share an operator and a target; the resolver already
	// ranked them, and the runner picks the same winner, so the catalog lists
	// the pair once.
	const seen = new Set<string>();
	return OPERATORS.flatMap((operator) =>
		objectResolver.resolve(operator).flatMap((candidate) => {
			const type = candidate.targetType
				? objectRegistry.type(candidate.targetType)
				: undefined;
			const target = candidate.targetType ?? candidate.id;
			const names = [type?.label, type?.pluralLabel, candidate.targetType]
				.filter(Boolean)
				.join(", ");
			const id = `core.${operator}:${target}`;
			if (seen.has(id)) return [];
			seen.add(id);
			return {
				id,
				operator,
				targetType: candidate.targetType,
				...(candidate.kind === "operation"
					? { operationId: candidate.id }
					: {}),
				brief:
					candidate.kind === "operation"
						? candidate.label
						: `${verbs[operator]} ${candidate.label}`,
				description:
					candidate.description ??
					(operator === "select"
						? `Create or update a ${names || target} set. Use for lists, groups, searches, and every request with a condition or filter.`
						: `${labels[operator]} of ${names || target}`),
				category: "operator" as const,
				priority: "primary" as const,
				exposure: "user" as const,
				parameters:
					candidate.operation?.parameters ??
					candidateParameters(candidate.targetType, operator),
			};
		}),
	);
}

/** Both levels in one list: the bare operators and everything they resolve to. */
export function catalogEntries(): OperatorCatalogEntry[] {
	return [
		...operatorCatalogEntries().map((entry) => ({
			...entry,
			priority: "secondary" as const,
		})),
		...operatorCandidateEntries(),
	];
}

export function catalogEntry(id: string): OperatorCatalogEntry | undefined {
	return CANDIDATE.test(id)
		? operatorCandidateEntries().find((entry) => entry.id === id)
		: operatorCatalogEntry(id);
}

/**
 * Invoke either level by id. A candidate id already carries the choice the
 * resolver would otherwise have to make, so it is passed straight through as
 * the target rather than re-derived from the arguments.
 */
export async function invokeCatalogEntry(
	id: string,
	params: Record<string, unknown> = {},
	source: "assistant" | "user" = "user",
	selectionAtTurn?: ActiveSelectionContext | null,
): Promise<unknown> {
	const entry = catalogEntry(id);
	if (!entry) throw new Error(`[object-runtime] Unknown catalog entry: ${id}`);
	if (entry.operator === "select" && entry.targetType && !entry.operationId) {
		const command = params as SelectCommand;
		if (command.scope !== "new" && command.scope !== "current") {
			throw new Error("[object-runtime] select requires scope new or current");
		}
		if (command.mode !== "replace" && command.mode !== "refine") {
			throw new Error(
				"[object-runtime] select requires mode replace or refine",
			);
		}
		const current = selectionAtTurn ?? activeSelection();
		const ref = applySelectCommand(entry.targetType, command, current?.ref);
		await loadObjectType(entry.targetType);
		const type = objectRegistry.type(entry.targetType);
		const stats =
			ref.selection.kind === "query" && type?.selection?.inspect
				? await type.selection.inspect(
						ref.selection.filter,
						ref.selection.presets,
					)
				: undefined;
		await presentReference(ref, {
			source,
			...(command.scope === "current" && current?.tabKey
				? { key: current.tabKey }
				: {}),
		});
		// A selection is a transport contract, not a UI object. Return a fresh
		// JSON value so the transcript always receives its filter and count even
		// when presentation listeners carry live state elsewhere in the runtime.
		return {
			selection: {
				kind: "set" as const,
				type: ref.type,
				selection:
					ref.selection.kind === "ids"
						? { kind: "ids" as const, ids: [...ref.selection.ids] }
						: {
								kind: "query" as const,
								...(ref.selection.filter
									? { filter: ref.selection.filter }
									: {}),
								...(ref.selection.presets?.length
									? { presets: ref.selection.presets }
									: {}),
							},
			},
			...(stats ? { stats: { totalCount: Number(stats.totalCount) } } : {}),
		};
	}
	const references = (params.references as DomainRef[] | undefined) ?? [];

	// An operation that composes its object names the screen that builds it, and
	// that rule belongs to the runtime, not to the surface that triggered it: a
	// request from the assistant has no more idea how deep the object goes than
	// a click in the panel does. Without this the assistant fills the operation's
	// empty `parameters` with nothing and the service rejects the blank object.
	// References are the exception — they are the composition, already made, so
	// "create an outreach from these companies" still runs the operation.
	const composing = entry.operationId
		? objectRegistry.operation(entry.operationId)
		: undefined;
	if (composing?.view && entry.targetType && references.length === 0) {
		await loadObjectType(entry.targetType);
		await presentReference(objectRef(entry.targetType, NEW_OBJECT_ID), {
			viewId: composing.view,
			source,
		});
		return {
			ok: true,
			presented: {
				type: entry.targetType,
				id: NEW_OBJECT_ID,
				viewId: composing.view,
			},
			note: "Opened the screen that composes this object; it is not created yet.",
		};
	}

	const result = entry.operationId
		? await executeOperation({
				operationId: entry.operationId,
				references,
				params:
					(params.params as Record<string, unknown> | undefined) ?? params,
				source,
			})
		: await invokeOperator(
				entry.operator,
				{
					...params,
					...(entry.targetType ? { targetType: entry.targetType } : {}),
				},
				source,
			);
	// The caller is a transcript: what it does with the answer is serialise it.
	// An operation is free to return a live object, so a value that cannot be
	// serialised is replaced by the fact that the call happened.
	return jsonSafe(result)
		? result
		: { ok: true, id, note: "Result is not serializable and was omitted" };
}

function jsonSafe(value: unknown): boolean {
	try {
		JSON.stringify(value);
		return true;
	} catch {
		return false;
	}
}

export function searchOperatorCatalog(
	query: string,
	limit = 12,
): OperatorCatalogEntry[] {
	const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
	// A bare `open` is only valid with a concrete object id. It therefore cannot
	// fulfil a collection request and must not be offered to the LLM as a search
	// result. Resolved `open` candidates remain available once the caller has an
	// actual reference.
	const searchable = () =>
		catalogEntries().filter((entry) => entry.id !== "core.open");
	if (words.length === 0) return searchable().slice(0, limit);

	const text = (entry: OperatorCatalogEntry) =>
		`${entry.id} ${entry.brief} ${entry.description}`.toLocaleLowerCase();
	const ranked = searchable()
		.map((entry) => ({
			entry,
			hits: words.filter((word) => text(entry).includes(word)).length,
		}))
		.filter(({ hits }) => hits > 0)
		.sort(
			(left, right) =>
				right.hits - left.hits || left.entry.id.localeCompare(right.entry.id),
		)
		.slice(0, limit)
		.map(({ entry }) => entry);

	if (ranked.length > 0) return ranked;

	// Labels are English and the user may not be. A selection is the safe common
	// denominator for an unknown collection request: unlike generic `open`, it
	// always creates a concrete set and carries a fixed target type. The routing
	// model's English area hint normally supplies the precise match; this fallback
	// keeps the collection vocabulary available when it does not.
	const selections = operatorCandidateEntries().filter(
		(entry) => entry.operator === "select",
	);
	// Keep room for the route hint in `mergeCandidates`: a Russian request falls
	// back here, while its translated area can still append the specific type.
	return (selections.length > 0 ? selections : searchable()).slice(
		0,
		Math.min(limit, FALLBACK_SELECTION_LIMIT),
	);
}

type OperatorInvocation = {
	targetType?: string;
	id?: string;
	ids?: string[];
	query?: Record<string, unknown>;
	filter?: Record<string, unknown>;
	categories?: CategoryId[];
	params?: Record<string, unknown>;
	references?: DomainRef[];
};

export async function invokeOperator(
	operator: Operator,
	input: OperatorInvocation = {},
	source: "assistant" | "user" = "user",
): Promise<unknown> {
	if (operator === "open" && (!input.targetType || !input.id)) {
		throw new Error("[object-runtime] open requires targetType and object id");
	}
	const references = [...(input.references ?? [])];
	if (input.targetType && input.id)
		references.push(objectRef(input.targetType, input.id));
	if (input.targetType && input.ids) {
		references.push(setRef(input.targetType, { kind: "ids", ids: input.ids }));
	}
	const candidates = objectResolver.resolve(operator, {
		references,
		targetType: input.targetType,
		categories: input.categories,
	});
	const candidate = candidates[0];
	if (!candidate) {
		// The caller is usually a model that guessed a type name. Saying what the
		// operator does accept is what lets it correct itself on the next call.
		const available = targetList(operatorTargets(operator));
		throw new Error(
			`[object-runtime] Nothing resolves for ${operator}${
				input.targetType ? ` with targetType "${input.targetType}"` : ""
			}${available ? `; available: ${available}` : ""}`,
		);
	}
	if (candidate.kind === "operation") {
		return executeOperation({
			operationId: candidate.id,
			references,
			params: input.params ?? {},
			source,
		});
	}
	if (!candidate.targetType)
		throw new Error(`[object-runtime] ${operator} resolved without a type`);
	const type = objectRegistry.type(candidate.targetType);
	if (!type)
		throw new Error(
			`[object-runtime] Unknown object type: ${candidate.targetType}`,
		);
	await authorizeObjectType(type);
	const selectedObject = references.find(
		(ref) => ref.kind === "object" && ref.type === candidate.targetType,
	);
	if (operator === "open" && !selectedObject) {
		throw new Error("[object-runtime] open requires an object id");
	}
	const ref =
		selectedObject ??
		(operator === "select" || !input.id
			? setRef(
					candidate.targetType,
					input.ids
						? { kind: "ids", ids: input.ids }
						: { kind: "query", filter: input.filter ?? input.query },
				)
			: objectRef(candidate.targetType, input.id));
	await presentReference(ref, { source });
	return ref;
}
