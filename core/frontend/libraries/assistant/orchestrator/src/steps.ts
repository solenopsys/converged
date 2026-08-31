import { parseJsonObject, readString } from "./json";
import type {
	FunctionBrief,
	OrchestratorCatalog,
	PlanContext,
	Step,
	StepAnswer,
	ToolSpec,
} from "./types";

// The built-in flow: route → search → select → args → invoke (docs/AI.md §4.2).
// Two of the five are local, so a function call costs three vendor round-trips,
// and a plain question costs one. Each step is a module: a host that needs a
// different flow composes its own table instead of patching the kernel.
//
// Every deciding step asks for its answer as a function call — the gateway
// carries tools to all four providers (resonus `ChatRequest.tools`), so the
// answer arrives structured. Prose is the fallback, not the contract: light
// models otherwise wrap JSON in fences, argue with the instruction, or reply
// with nothing at all.

const CANDIDATE_LIMIT = 12;

/**
 * A fact goes into the answer step's context, so it must stay a fact. Anything
 * bigger is a payload that belongs behind a reference (§2, "by reference, not
 * by value") — the kernel refuses to carry it instead of quietly truncating.
 */
const FACT_LIMIT_BYTES = 8192;

export type FunctionStepsOptions = {
	catalog: OrchestratorCatalog;
	candidateLimit?: number;
	factLimitBytes?: number;
};

const candidateLine = (fn: FunctionBrief): string =>
	fn.description && fn.description !== fn.brief
		? `${fn.id} — ${fn.brief}: ${fn.description}`
		: `${fn.id} — ${fn.brief}`;

function hostContextLine(context: PlanContext): string {
	if (context.hostContext === undefined) return "";
	try {
		const encoded = JSON.stringify(context.hostContext);
		return encoded && encoded.length <= 4096
			? `\n\nCurrent application context: ${encoded}`
			: "";
	} catch {
		return "";
	}
}

function needsArgumentModel(parameters: ToolSpec["parameters"] | undefined): boolean {
	// A missing schema is unknown, so preserve the model step for existing hosts.
	// Optional fields still need the step: the model can extract values from the
	// request and prefill a form without inventing values for omitted fields.
	return (
		!parameters || Object.keys(parameters.properties).length > 0
	);
}

function schemaDefaults(
	parameters: ToolSpec["parameters"] | undefined,
): Record<string, unknown> {
	if (!parameters) return {};
	return Object.fromEntries(
		Object.entries(parameters.properties).flatMap(([key, value]) => {
			if (!value || typeof value !== "object" || !("default" in value))
				return [];
			return [[key, (value as { default: unknown }).default]];
		}),
	);
}

function selectionArgumentsHint(
	parameters: ToolSpec["parameters"] | undefined,
): string | undefined {
	const properties = parameters?.properties;
	if (
		!properties ||
		!("scope" in properties) ||
		!("mode" in properties) ||
		!("filter" in properties)
	) {
		return undefined;
	}
	const filter = properties.filter as
		| { properties?: Record<string, { properties?: Record<string, unknown> }> }
		| undefined;
	const [field, fieldSchema] = Object.entries(filter?.properties ?? {}).find(
		([id]) => id !== "AND" && id !== "OR" && id !== "NOT",
	) ?? ["field", undefined];
	const operator = Object.keys(fieldSchema?.properties ?? {})[0] ?? "eq";
	const example = {
		scope: "new",
		mode: "replace",
		filter: { [field]: { [operator]: "<value from user>" } },
	};
	return [
		"This is a selection. Create the filter from every constraint explicitly stated by the user; do not add constraints they did not state.",
		`Example shape from this function schema: ${JSON.stringify(example)}.`,
		"For an unfiltered new list use scope=new and mode=replace without filter. To add a condition to the active list use scope=current and mode=refine.",
	].join(" ");
}

/** The step's own call if the model made it, otherwise its prose parsed as JSON. */
function structured(
	answer: StepAnswer | undefined,
	toolName: string,
): Record<string, unknown> | undefined {
	const calls = answer?.toolCalls.filter(
		(candidate) => candidate.name === toolName,
	);
	// Some providers emit an empty provisional tool call before the final one.
	const call =
		calls?.find((candidate) => Object.keys(candidate.args).length > 0) ??
		calls?.at(-1);
	if (call) return call.args;
	return answer?.text ? parseJsonObject(answer.text) : undefined;
}

export function createFunctionSteps({
	catalog,
	candidateLimit = CANDIDATE_LIMIT,
	factLimitBytes = FACT_LIMIT_BYTES,
}: FunctionStepsOptions): ReadonlyArray<Step<PlanContext>> {
	const routeTool: ToolSpec = {
		name: "route",
		description: "Say whether the user asked the application to do something.",
		parameters: {
			type: "object",
			properties: {
				intent: {
					type: "string",
					enum: ["function", "answer"],
					description:
						'"function" when the user asks the application to act, "answer" for anything else',
				},
				area: {
					type: "string",
					description:
						"Search words for the local function catalog, in English: 'logs', 'orders list', 'cron'",
				},
			},
			required: ["intent"],
		},
	};

	const route: Step<PlanContext> = {
		name: "route",
		tools: () => [routeTool],
		ask: (context) => {
			const areas = catalog
				.listCategories()
				.map(({ id, count }) => `${id} (${count})`)
				.join(", ");
			return `Areas: ${areas || "none"}${hostContextLine(context)}\n\nUser: ${context.userText}`;
		},
		apply: (_context, answer) => {
			const decision = structured(answer, routeTool.name);
			if (readString(decision, "intent") !== "function") {
				return { done: { kind: "answer" } };
			}
			return { patch: { area: readString(decision, "area") } };
		},
	};

	// Local: the catalog is in this process, so searching it is microseconds and
	// zero requests. Candidates go straight into the next step's prompt.
	const search: Step<PlanContext> = {
		name: "search",
		apply: ({ area, userText }) => {
			// `area` comes from a fast model and is only a search hint. Searching it
			// alone lets a hallucinated area (for example "catalog") turn an
			// unrelated singleton into an automatic invocation. The user's message
			// is the authoritative intent and always gets the first candidate slots.
			const query = area ?? userText;
			const candidates = mergeCandidates(
				catalog,
				userText,
				area,
				candidateLimit,
			);
			if (candidates.length === 0) {
				return { done: { kind: "function-missed", area: query, candidates } };
			}

			// One candidate is not worth a round-trip to pick it.
			return {
				patch: {
					area: query,
					candidates,
					id: candidates.length === 1 ? candidates[0]?.id : undefined,
				},
			};
		},
	};

	const select: Step<PlanContext> = {
		name: "select",
		when: ({ id }) => !id,
		tools: ({ candidates }) => [
			{
				name: "select",
				description: "Pick the one function that does what the user asked.",
				parameters: {
					type: "object",
					properties: {
						id: {
							type: "string",
							enum: candidates.map((fn) => fn.id),
							description: "Exact id from the candidate list",
						},
					},
					required: ["id"],
				},
			},
		],
		ask: (context) =>
			`Candidates:\n${context.candidates.map(candidateLine).join("\n")}${hostContextLine(context)}\n\nUser: ${context.userText}`,
		apply: async ({ candidates, area, userText }, answer) => {
			const id = readString(structured(answer, "select"), "id");
			// An id the model invented is not a function: better to miss than to
			// call something the user did not ask for.
			if (!id || !candidates.some((fn) => fn.id === id)) {
				return {
					done: {
						kind: "function-missed",
						area: area ?? userText,
						candidates,
					},
				};
			}
			return { patch: { id } };
		},
	};

	// Local and deliberate: a selection's filter vocabulary belongs to the
	// service. Loading it after the function is chosen, rather than speculating
	// during search, makes the route → function → descriptor → arguments
	// protocol observable and prevents a stale fallback schema reaching the LLM.
	const describe: Step<PlanContext> = {
		name: "describe",
		when: ({ id }) => Boolean(id),
		apply: async ({ id }) => {
			if (!id) return {};
			const parameters = await catalog.load?.(id);
			const meta = catalog.meta(id);
			if (!meta) {
				throw new Error(
					`[orchestrator] Function "${id}" disappeared while loading its parameters`,
				);
			}
			return parameters ? { patch: { parameters } } : {};
		},
	};

	const args: Step<PlanContext> = {
		name: "args",
		allowEmptyAnswer: true,
		// The tool is the target function itself when the host publishes a schema:
		// then the model fills real parameters instead of describing them.
		tools: ({ id, parameters }) => {
			const meta = id ? catalog.meta(id) : undefined;
			const schema = parameters ?? meta?.parameters;
			if (!meta || !needsArgumentModel(schema)) return [];
			return [
				{
					name: "call",
					description: meta.brief ?? meta.description,
					parameters: schema ?? {
						type: "object",
						properties: {},
					},
				},
			];
		},
		ask: (context) => {
			const { id, userText } = context;
			const meta = id ? catalog.meta(id) : undefined;
			const schema = context.parameters ?? meta?.parameters;
			if (!meta || !needsArgumentModel(schema)) return undefined;
			return [
				`Function: ${meta.id}`,
				meta.description,
				selectionArgumentsHint(schema),
				"Call the call tool exactly once. Extract every value explicitly present in the user request into its matching field. Follow each field description: when it explicitly asks to generate a draft, generate it; otherwise do not invent omitted values.",
				`Argument schema: ${JSON.stringify(schema)}`,
				hostContextLine(context),
				`User: ${userText}`,
			]
				.filter(Boolean)
				.join("\n\n");
		},
		apply: ({ id, parameters }, answer) => {
			const meta = id ? catalog.meta(id) : undefined;
			const schema = parameters ?? meta?.parameters;
			return {
				patch: {
					args: {
						...schemaDefaults(schema),
						...(structured(answer, "call") ?? {}),
					},
				},
			};
		},
	};

	// Local and terminal. A failed call is a fact, not a break: the answer step
	// explains it in words (§4.7).
	const invoke: Step<PlanContext> = {
		name: "invoke",
		apply: async ({ id, args: params = {} }) => {
			if (!id) {
				throw new Error(
					"[orchestrator] invoke step reached without a function id",
				);
			}
			try {
				const fact = await catalog.invoke(id, params);
				return {
					done: { kind: "function", id, args: params, fact: cap(fact) },
				};
			} catch (error) {
				return {
					done: {
						kind: "function",
						id,
						args: params,
						fact: {
							ok: false,
							error: error instanceof Error ? error.message : String(error),
						},
					},
				};
			}
		},
	};

	function cap(fact: unknown): unknown {
		let size: number;
		try {
			size = JSON.stringify(fact ?? null)?.length ?? 0;
		} catch {
			// A function may hand back something that is not JSON — a live object,
			// a component, an effector unit, anything holding a cycle. The call
			// still happened, so what goes into the transcript is that it did.
			// Reporting this as a failed call makes the model apologise for work
			// that succeeded.
			return { ok: true, note: "Result is not serializable and was omitted" };
		}
		if (size <= factLimitBytes) return fact;
		return {
			ok: false,
			error: `Function result is ${size} bytes, over the ${factLimitBytes} byte limit: return a reference (id / cacheKey), not the payload`,
		};
	}

	return [route, search, select, describe, args, invoke];
}

function mergeCandidates(
	catalog: OrchestratorCatalog,
	userText: string,
	area: string | undefined,
	limit: number,
): FunctionBrief[] {
	const merged = new Map<string, FunctionBrief>();
	for (const query of [userText, area]) {
		if (!query?.trim()) continue;
		for (const candidate of catalog.search(query, limit)) {
			if (!merged.has(candidate.id)) merged.set(candidate.id, candidate);
		}
	}
	return [...merged.values()].slice(0, limit);
}
