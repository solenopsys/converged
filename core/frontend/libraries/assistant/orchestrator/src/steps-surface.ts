import { parseJsonObject } from "./json";
import { createFunctionSteps } from "./steps";
import type {
	Choice,
	FunctionBrief,
	OrchestratorCatalog,
	PlanContext,
	Position,
	Step,
	StepAnswer,
	ToolSpec,
} from "./types";

// The surface flow: surface → action → state.
//
// It differs from the function flow (steps.ts) in one way that changes
// everything else: **each step commits to the interface before the next one
// runs.** Choosing a surface mounts the tab. Choosing a button presses it.
// Only then does the last step fill in a state. The user sees movement after
// the first second instead of after the third, a wrong turn is visible while
// it is still cheap to correct, and every step after the first reads a screen
// that really is in the state it was told about.
//
// Two consequences worth naming, because they are not free:
//
// * A turn that stops early leaves the user somewhere new. That is the intended
//   result — the tab it mounted is the tab they asked for — but it means
//   "cancel" is no longer "put it back".
// * Levels 1 and 2 are safe to commit blind: mounting is additive and pressing
//   is navigation. Level 3 is not, so it stays a proposal that the existing
//   argument machinery validates before anything is invoked.
//
// The other difference is the answer format. Both deciding steps choose from a
// list the step itself just built, so they answer with its number. An id like
// `core.select:sales.outreach-target` costs about ten tokens, appears twice
// (once in the enum, once in the list) and has to be copied exactly; a number
// costs one and cannot be misspelt into a different real function. Validation
// is a range check instead of a lookup, and an out-of-range answer is a miss
// rather than a call nobody asked for.

/** Ids of the host functions that commit each level. */
export type SurfaceCommitIds = {
	mountSurface: string;
	pressSubtab: string;
};

/**
 * The catalog namespaces an operation by the operator that reaches it —
 * `core.execute:<operation id>` (object-runtime/catalog.ts) — so these are the
 * ids the flow must call, not the bare ones the shell declares.
 */
export const DEFAULT_COMMITS: SurfaceCommitIds = {
	mountSurface: "core.execute:workspace.surface.mount",
	pressSubtab: "core.execute:workspace.subtab.press",
};

export type SurfaceStepsOptions = {
	catalog: OrchestratorCatalog;
	commits?: Partial<SurfaceCommitIds>;
	/** Functions offered at the action step, per surface. */
	candidateLimit?: number;
};

const CANDIDATE_LIMIT = 24;

/**
 * How much of a description earns its place on a candidate line. The catalog
 * writes long ones for search to rank against — "Create or update a Company,
 * Companies, companies.company set. Use for lists, groups, searches, and every
 * request with a condition or filter." — and repeating that for twenty
 * candidates is most of the step's input. The brief already carries the
 * meaning; the tail is for the matcher, not the reader.
 */
const DETAIL_LIMIT = 80;

/** A short second line, or none: never the search blurb in full. */
function hint(fn: FunctionBrief): { detail?: string } {
	const detail = fn.description?.trim();
	if (!detail || detail === fn.brief) return {};
	const firstSentence = detail.split(/(?<=[.!?])\s/)[0] ?? detail;
	return firstSentence.length <= DETAIL_LIMIT ? { detail: firstSentence } : {};
}

/** `1 Sales — Leads, contacts, offers and campaigns` */
const numbered = (choices: readonly Choice[]): string =>
	choices
		.map(
			(choice, index) =>
				`${index + 1} ${choice.label}${choice.detail ? ` — ${choice.detail}` : ""}`,
		)
		.join("\n");

/**
 * One line, always in the same shape, prepended to every step. It replaces a
 * JSON blob of host state: the steps need to know where the user is standing,
 * and that is a sentence, not a document.
 */
export function positionLine(position: Position | undefined): string {
	if (!position?.surface) return "Position: nothing open";
	const parts = [position.surfaceLabel ?? position.surface];
	if (position.subtab) parts.push(position.subtabLabel ?? position.subtab);
	const trail = parts.join(" → ");
	return `Position: ${trail}${position.state ? ` — ${position.state}` : ""}`;
}

const choiceTool = (description: string): ToolSpec => ({
	name: "choose",
	description,
	parameters: {
		type: "object",
		properties: {
			n: {
				type: "integer",
				description:
					"Number of the chosen line, or 0 when none of them is what was asked for",
			},
		},
		required: ["n"],
	},
});

/**
 * Cuts the schema down to what is actually possible right now.
 *
 * Three turns in a row failed on the same thing: the model chose
 * `scope: "current"` with no active selection, then with a selection of the
 * wrong type, then paired `scope: "new"` with `mode: "refine"`. None of those
 * are judgement calls — the host knows which are legal before it asks. The fix
 * is the same one that made the deciding steps reliable: shrink the answer
 * space rather than explain it. A rule the model cannot read is a rule it
 * cannot break.
 *
 * `current` survives only when the pressed subtab really holds a set of the
 * type this function acts on. `filter` survives only when there is something to
 * filter by — the assistant chat selection has no fields at all, and offering
 * an empty object is what invited `{"chat_type": ...}` out of thin air.
 */
function narrow(
	schema: ToolSpec["parameters"] | undefined,
	context: Readonly<PlanContext>,
): ToolSpec["parameters"] | undefined {
	const properties = schema?.properties;
	if (!schema || !properties?.scope || !properties.mode) return schema;

	const continues =
		Boolean(context.targetType) &&
		context.position?.type === context.targetType;
	const next: Record<string, unknown> = { ...properties };

	if (!continues) {
		next.scope = {
			type: "string",
			enum: ["new"],
			default: "new",
			description: "Opens a new set",
		};
		next.mode = {
			type: "string",
			enum: ["replace"],
			default: "replace",
			description: "Replaces the filter",
		};
	}

	const filter = next.filter as
		| { properties?: Record<string, unknown> }
		| undefined;
	const fields = Object.keys(filter?.properties ?? {}).filter(
		(key) => key !== "AND" && key !== "OR" && key !== "NOT",
	);
	if (filter && fields.length === 0) delete next.filter;

	return { ...schema, properties: next };
}

/** The `call` tool's arguments, or its prose fallback parsed as JSON. */
function structuredCall(
	answer: StepAnswer | undefined,
): Record<string, unknown> | undefined {
	const calls = answer?.toolCalls.filter(({ name }) => name === "call");
	// Some providers emit an empty provisional call before the final one.
	const call =
		calls?.find((candidate) => Object.keys(candidate.args).length > 0) ??
		calls?.at(-1);
	if (call) return call.args;
	return answer?.text ? parseJsonObject(answer.text) : undefined;
}

function schemaDefaults(
	parameters: ToolSpec["parameters"] | undefined,
): Record<string, unknown> {
	if (!parameters) return {};
	return Object.fromEntries(
		Object.entries(parameters.properties).flatMap(([key, value]) =>
			value && typeof value === "object" && "default" in value
				? [[key, (value as { default: unknown }).default]]
				: [],
		),
	);
}

/** The chosen line, 1-based, or undefined for 0, a miss or nonsense. */
export function chosenNumber(
	answer: StepAnswer | undefined,
	total: number,
): number | undefined {
	const call = answer?.toolCalls.find(({ name }) => name === "choose");
	const raw = call
		? call.args.n
		: answer?.text
			? parseJsonObject(answer.text)?.n
			: undefined;
	const value =
		typeof raw === "number"
			? raw
			: typeof raw === "string" && raw.trim() !== ""
				? Number(raw)
				: Number.NaN;
	if (!Number.isInteger(value) || value < 1 || value > total) return undefined;
	return value;
}

export function createSurfaceSteps({
	catalog,
	commits,
	candidateLimit = CANDIDATE_LIMIT,
}: SurfaceStepsOptions): ReadonlyArray<Step<PlanContext>> {
	const ids: SurfaceCommitIds = { ...DEFAULT_COMMITS, ...commits };
	const surfaces = (): Choice[] =>
		(catalog.listModules?.() ?? []).map(({ id, label, description }) => ({
			id,
			label,
			...(description ? { detail: description } : {}),
		}));

	/**
	 * Level one. Picks the tab and mounts it, so the screen has changed before
	 * the second step is even asked. `0` means the request was not navigation at
	 * all, which is the same decision the old `route` step made under the name
	 * `intent` — asked here as part of the choice rather than beside it, so it
	 * costs nothing extra.
	 */
	const surface: Step<PlanContext> = {
		name: "surface",
		when: ({ id, module }) => !id && !module,
		retryWhenEmpty: true,
		allowEmptyAnswer: true,
		tools: () => [
			choiceTool(
				"Pick the section of the application the user's request belongs to.",
			),
		],
		ask: (context) => {
			const choices = surfaces();
			if (choices.length === 0) return undefined;
			return [
				`Sections:\n${numbered(choices)}`,
				positionLine(context.position),
				`User: ${context.userText}`,
			].join("\n\n");
		},
		apply: async (context, answer) => {
			const choices = surfaces();
			if (choices.length === 0) return { done: { kind: "answer" } };
			const picked = chosenNumber(answer, choices.length);
			// Nothing fits: the request is a question, not navigation.
			if (picked === undefined) return { done: { kind: "answer" } };
			const chosen = choices[picked - 1] as Choice;

			// The commit. From here the user is looking at the tab they asked for,
			// whatever happens to the rest of the turn.
			const alreadyThere = context.position?.surface === chosen.id;
			if (!alreadyThere) {
				try {
					await catalog.invoke(ids.mountSurface, { surface: chosen.id });
				} catch (error) {
					// The commit is what makes the choice visible early; it is not what
					// makes the request work. Whatever the later steps invoke will
					// present into this surface anyway, so a refused mount costs the
					// user a second of feedback, not their request.
					console.warn(
						`[orchestrator] Could not mount "${chosen.id}" up front; the turn continues without the early commit`,
						error,
					);
				}
			}

			return {
				patch: {
					module: chosen.id,
					// The label, not the id: the position line is read by the later
					// steps, and `Position: sf-companies` is an invitation to copy that
					// string into an argument — which is exactly what happened.
					position: {
						...context.position,
						surface: chosen.id,
						surfaceLabel: chosen.label,
					},
					trail: [
						...(context.trail ?? []),
						{
							step: "surface",
							chosen: chosen.id,
							chosenLabel: chosen.label,
							options: choices.map(({ id, label }) => ({ id, label })),
						},
					],
				},
			};
		},
	};

	/**
	 * Level two, over one list: the buttons already open in this surface and the
	 * functions it owns. They belong together because the user does not
	 * distinguish them — "the active ones" is a button when that button exists
	 * and a filter when it does not.
	 *
	 * A button is terminal: pressing it *is* the whole request, and there is no
	 * state left to fill. A function continues to level three.
	 */
	const action: Step<PlanContext> = {
		name: "action",
		when: ({ id, module }) => !id && Boolean(module),
		retryWhenEmpty: true,
		allowEmptyAnswer: true,
		tools: (context) =>
			listFor(context).length > 0
				? [
						choiceTool(
							"Pick the one button or function that does what the user asked.",
						),
					]
				: [],
		ask: (context) => {
			const entries = listFor(context);
			if (entries.length === 0) return undefined;
			return [
				`Available here:\n${numbered(entries.map(({ choice }) => choice))}`,
				positionLine(context.position),
				`User: ${context.userText}`,
			].join("\n\n");
		},
		apply: async (context, answer) => {
			const entries = listFor(context);
			const functions = entries.flatMap(({ fn }) => (fn ? [fn] : []));
			if (entries.length === 0) {
				return {
					done: {
						kind: "function-missed",
						area: context.module ?? context.userText,
						candidates: [],
						trail: context.trail,
					},
				};
			}
			const picked = chosenNumber(answer, entries.length);
			if (picked === undefined) {
				return {
					done: {
						kind: "function-missed",
						area: context.module ?? context.userText,
						candidates: functions,
						trail: context.trail,
					},
				};
			}
			const entry = entries[picked - 1] as (typeof entries)[number];
			const trail = [
				...(context.trail ?? []),
				{
					step: "action",
					chosen: entry.choice.id,
					chosenLabel: entry.choice.label,
					options: entries.map(({ choice }) => ({
						id: choice.id,
						label: choice.label,
					})),
				},
			];

			if (entry.subtab) {
				// Pressing a button is the answer to the whole request; the second
				// commit lands and the turn is done.
				let fact: unknown;
				try {
					fact = await catalog.invoke(ids.pressSubtab, { key: entry.subtab });
				} catch (error) {
					fact = {
						ok: false,
						error: error instanceof Error ? error.message : String(error),
					};
				}
				return {
					done: {
						kind: "function",
						id: ids.pressSubtab,
						args: { key: entry.subtab },
						fact,
						trail,
					},
				};
			}

			return {
				patch: {
					id: entry.choice.id,
					trail,
					...(entry.fn?.targetType ? { targetType: entry.fn.targetType } : {}),
				},
			};
		},
	};

	/** Buttons first: what is already open continues the work rather than restarting it. */
	function listFor(
		context: Readonly<PlanContext>,
	): Array<{ choice: Choice; subtab?: string; fn?: FunctionBrief }> {
		const module = context.module;
		if (!module) return [];
		const buttons = (catalog.subtabs?.(module) ?? [])
			.filter((subtab) => !subtab.pressed)
			.map((subtab) => ({
				choice: {
					id: `subtab:${subtab.key}`,
					label: subtab.title,
					detail: "already open here",
				},
				subtab: subtab.key,
			}));
		const functions = (catalog.byModule?.(module) ?? [])
			.slice(0, candidateLimit)
			.map((fn) => ({
				choice: { id: fn.id, label: fn.brief, ...hint(fn) },
				fn,
			}));
		return [...buttons, ...functions];
	}

	/**
	 * Level three: the state. The schema is real — it comes from the service that
	 * owns the selection — so the tool carries it and the message does not.
	 *
	 * The old argument step sent that schema **twice**: once as the tool
	 * definition and once again spelled out under "Argument schema:", plus a
	 * paragraph of instructions, plus the host context as JSON. For a companies
	 * selection that was some three thousand characters of input to produce
	 * `{"scope":"new","mode":"replace"}`. The instructions belong in the step's
	 * prompt section, the schema belongs in the tool, and what is left here is
	 * the position and the sentence the user actually typed.
	 */
	const state: Step<PlanContext> = {
		name: "state",
		when: ({ argumentsFinal }) => !argumentsFinal,
		allowEmptyAnswer: true,
		retryWhen: (context, answer) => {
			const schema = schemaOf(context);
			const required = schema?.required ?? [];
			if (required.length === 0) return false;
			const values = {
				...schemaDefaults(schema),
				...(context.known ?? {}),
				...(structuredCall(answer) ?? {}),
			};
			return required.some((key) => !Object.hasOwn(values, key));
		},
		tools: (context) => {
			const meta = context.id ? catalog.meta(context.id) : undefined;
			const schema = schemaOf(context);
			if (!meta || !schema || Object.keys(schema.properties).length === 0)
				return [];
			return [
				{
					name: "call",
					description: meta.brief ?? meta.description,
					parameters: schema,
				},
			];
		},
		ask: (context) => {
			const meta = context.id ? catalog.meta(context.id) : undefined;
			const schema = schemaOf(context);
			if (!meta || !schema || Object.keys(schema.properties).length === 0)
				return undefined;
			return [
				`Function: ${meta.brief ?? meta.id}`,
				positionLine(context.position),
				`User: ${context.userText}`,
			].join("\n\n");
		},
		apply: (context, answer) => {
			const meta = context.id ? catalog.meta(context.id) : undefined;
			const schema = schemaOf(context);
			const filled = structuredCall(answer);
			const values = {
				...schemaDefaults(schema),
				...(context.known ?? {}),
				...(filled ?? {}),
			};
			const missing = (schema?.required ?? []).filter(
				(key) => !Object.hasOwn(values, key),
			);
			if (meta && missing.length > 0) {
				return {
					done: {
						kind: "function-incomplete",
						id: meta.id,
						args: values,
						missing,
						trail: context.trail,
					},
				};
			}
			return { patch: { args: values } };
		},
	};

	function schemaOf(
		context: Readonly<PlanContext>,
	): ToolSpec["parameters"] | undefined {
		const meta = context.id ? catalog.meta(context.id) : undefined;
		return narrow(context.parameters ?? meta?.parameters, context);
	}

	// `describe` and `invoke` are local steps with no prompt of their own, so
	// there is nothing to compact about them; they are reused as they are.
	const tail = createFunctionSteps({ catalog }).filter((step) =>
		["describe", "invoke"].includes(step.name),
	);
	const describe = tail.find(
		(step) => step.name === "describe",
	) as Step<PlanContext>;
	const invoke = tail.find(
		(step) => step.name === "invoke",
	) as Step<PlanContext>;

	return [surface, action, describe, state, invoke];
}
