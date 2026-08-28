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

function needsArgumentModel(meta: ReturnType<OrchestratorCatalog["meta"]>): boolean {
	// A missing schema is unknown, so preserve the model step for existing hosts.
	// Optional fields still need the step: the model can extract values from the
	// request and prefill a form without inventing values for omitted fields.
	return !meta?.parameters || Object.keys(meta.parameters.properties).length > 0;
}

function schemaDefaults(
	meta: ReturnType<OrchestratorCatalog["meta"]>,
): Record<string, unknown> {
	if (!meta?.parameters) return {};
	return Object.fromEntries(
		Object.entries(meta.parameters.properties).flatMap(([key, value]) => {
			if (!value || typeof value !== "object" || !("default" in value)) return [];
			return [[key, (value as { default: unknown }).default]];
		}),
	);
}

/** The step's own call if the model made it, otherwise its prose parsed as JSON. */
function structured(
	answer: StepAnswer | undefined,
	toolName: string,
): Record<string, unknown> | undefined {
	const calls = answer?.toolCalls.filter((candidate) => candidate.name === toolName);
	// Some providers emit an empty provisional tool call before the final one.
	const call = calls?.find((candidate) => Object.keys(candidate.args).length > 0) ?? calls?.at(-1);
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
		ask: ({ userText }) => {
			const areas = catalog
				.listCategories()
				.map(({ id, count }) => `${id} (${count})`)
				.join(", ");
			return `Areas: ${areas || "none"}\n\nUser: ${userText}`;
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
			const query = area ?? userText;
			const candidates = catalog.search(query, candidateLimit);
			if (candidates.length === 0) {
				return { done: { kind: "function-missed", area: query, candidates } };
			}

			const top = candidates[0];
			if (top && catalog.load) void catalog.load(top.id).catch(() => {});

			// One candidate is not worth a round-trip to pick it.
			return {
				patch: {
					area: query,
					candidates,
					id: candidates.length === 1 ? top?.id : undefined,
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
		ask: ({ userText, candidates }) =>
			`Candidates:\n${candidates.map(candidateLine).join("\n")}\n\nUser: ${userText}`,
		apply: ({ candidates, area, userText }, answer) => {
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

	const args: Step<PlanContext> = {
		name: "args",
		allowEmptyAnswer: true,
		// The tool is the target function itself when the host publishes a schema:
		// then the model fills real parameters instead of describing them.
		tools: ({ id }) => {
			const meta = id ? catalog.meta(id) : undefined;
			if (!meta || !needsArgumentModel(meta)) return [];
			return [
				{
					name: "call",
					description: meta.brief ?? meta.description,
					parameters: meta.parameters ?? {
						type: "object",
						properties: {},
					},
				},
			];
		},
		ask: ({ id, userText }) => {
			const meta = id ? catalog.meta(id) : undefined;
			if (!meta || !needsArgumentModel(meta)) return undefined;
			return [
				`Function: ${meta.id}`,
				meta.description,
				"Call the call tool exactly once. Extract every value explicitly present in the user request into its matching field. Follow each field description: when it explicitly asks to generate a draft, generate it; otherwise do not invent omitted values.",
				`Argument schema: ${JSON.stringify(meta.parameters)}`,
				`User: ${userText}`,
			].join("\n\n");
		},
		apply: ({ id }, answer) => {
			const meta = id ? catalog.meta(id) : undefined;
			return {
				patch: {
					args: {
						...schemaDefaults(meta),
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
				throw new Error("[orchestrator] invoke step reached without a function id");
			}
			try {
				const fact = await catalog.invoke(id, params);
				return { done: { kind: "function", id, args: params, fact: cap(fact) } };
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
		const size = JSON.stringify(fact ?? null)?.length ?? 0;
		if (size <= factLimitBytes) return fact;
		return {
			ok: false,
			error: `Function result is ${size} bytes, over the ${factLimitBytes} byte limit: return a reference (id / cacheKey), not the payload`,
		};
	}

	return [route, search, select, args, invoke];
}
