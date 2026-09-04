import { parseJsonObject, readString } from "./json";
import type {
	FocusEntry,
	FunctionBrief,
	FunctionChoice,
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
//
// The route step also picks the module, so narrowing the catalog to one owner
// costs no extra round-trip: it replaces the free-text `area` guess that used to
// be the only hint. Both that choice and the function choice are recorded in
// `trail` — the list that was offered and the one taken — so the transcript can
// show how a call was arrived at. `trail` is deliberately not derived from
// `StepTrace`: a trace carries the step's prompt and outcome, which is the
// model's reasoning and stays in the log.

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
	// What is being worked on comes first and in words: it is the answer to
	// "which one", and every step from routing to arguments needs it.
	const working = context.focus?.length
		? `\n\nCurrently working on: ${context.focus
				.map((entry) => `${entry.label} (${entry.type})`)
				.join(", ")}`
		: "";
	if (context.hostContext === undefined) return working;
	try {
		const encoded = JSON.stringify(context.hostContext);
		return encoded && encoded.length <= 4096
			? `${working}\n\nCurrent application context: ${encoded}`
			: working;
	} catch {
		return working;
	}
}

function needsArgumentModel(
	parameters: ToolSpec["parameters"] | undefined,
): boolean {
	// A missing schema is unknown, so preserve the model step for existing hosts.
	// Optional fields still need the step: the model can extract values from the
	// request and prefill a form without inventing values for omitted fields.
	return !parameters || Object.keys(parameters.properties).length > 0;
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

/** Appends one decision, keeping `trail` immutable for the context patch. */
const record = (
	context: Readonly<PlanContext>,
	choice: FunctionChoice,
): FunctionChoice[] => [...(context.trail ?? []), choice];

const optionsOf = (
	functions: ReadonlyArray<FunctionBrief>,
): FunctionChoice["options"] =>
	functions.map(({ id, brief }) => ({ id, label: brief }));

/**
 * Puts the functions of whatever is being worked on at the front of the list,
 * adding the ones lexical search could not have found, and sends `create` for a
 * type already in focus to the back. Order is the whole mechanism: `select` sees
 * a list, and what stands first is what continues the work.
 */
function admitFocus(
	ranked: FunctionBrief[],
	focus: ReadonlyArray<FocusEntry>,
	catalog: OrchestratorCatalog,
	module?: string,
): FunctionBrief[] {
	if (focus.length === 0) return ranked;
	const types = [...new Set(focus.map((entry) => entry.type))];
	const onFocus = new Map<string, FunctionBrief>();
	for (const fn of catalog.byTarget?.(types) ?? []) {
		if (fn.intent !== "create" && (!module || fn.module === module))
			onFocus.set(fn.id, fn);
	}
	// A function search already found keeps what search learned about it.
	for (const fn of ranked) {
		if (
			fn.targetType &&
			types.includes(fn.targetType) &&
			fn.intent !== "create"
		)
			onFocus.set(fn.id, fn);
	}
	const rest = ranked.filter((fn) => !onFocus.has(fn.id));
	const competing = (fn: FunctionBrief) =>
		fn.intent === "create" && fn.targetType && types.includes(fn.targetType);
	return [
		...onFocus.values(),
		...rest.filter((fn) => !competing(fn)),
		...rest.filter(competing),
	];
}

export function createFunctionSteps({
	catalog,
	candidateLimit = CANDIDATE_LIMIT,
	factLimitBytes = FACT_LIMIT_BYTES,
}: FunctionStepsOptions): ReadonlyArray<Step<PlanContext>> {
	// A single module is not a choice, and a host without modules keeps the old
	// flat behaviour. Read once per turn: the catalog is frozen for the turn.
	const knownModules = () => catalog.listModules?.() ?? [];

	const routeTool = (): ToolSpec => {
		const modules = knownModules();
		return {
			name: "route",
			description:
				"Say whether the user asked the application to do something.",
			parameters: {
				type: "object",
				properties: {
					intent: {
						type: "string",
						enum: ["function", "answer"],
						description:
							'"function" when the user asks the application to act, "answer" for anything else',
					},
					...(modules.length > 1
						? {
								module: {
									type: "string",
									enum: modules.map(({ id }) => id),
									description:
										"Section of the application that owns the wanted function. Omit only when no section fits.",
								},
							}
						: {}),
					area: {
						type: "string",
						description:
							"Search words for the local function catalog, in English: 'logs', 'orders list', 'cron'",
					},
				},
				required: ["intent"],
			},
		};
	};

	// Every step from here to `select` decides *what* to run. A step earlier in
	// the table may already know — the files module does — and then routing is
	// both a round-trip nobody needs and a chance to overwrite the answer.
	const route: Step<PlanContext> = {
		name: "route",
		when: ({ id }) => !id,
		retryWhenEmpty: true,
		tools: () => [routeTool()],
		ask: (context) => {
			const modules = knownModules();
			const areas =
				modules.length > 1
					? JSON.stringify(
							modules.map(({ id, label, count, description }) => ({
								id,
								label,
								count,
								...(description ? { description } : {}),
							})),
						)
					: catalog
							.listCategories()
							.map(({ id, count }) => `${id} (${count})`)
							.join(", ");
			return `Sections: ${areas || "none"}${hostContextLine(context)}\n\nUser: ${context.userText}`;
		},
		apply: (context, answer) => {
			const decision = structured(answer, "route");
			if (readString(decision, "intent") !== "function") {
				return { done: { kind: "answer" } };
			}
			const modules = knownModules();
			const picked = readString(decision, "module");
			// An invented module would narrow the search to nothing; treated as no
			// choice, so the flow degrades to the flat search rather than missing.
			const module = modules.some(({ id }) => id === picked)
				? picked
				: undefined;
			return {
				patch: {
					area: readString(decision, "area"),
					module,
					...(module
						? {
								trail: record(context, {
									step: "module",
									chosen: module,
									chosenLabel: modules.find(({ id }) => id === module)?.label,
									options: modules.map(({ id, label }) => ({ id, label })),
								}),
							}
						: {}),
				},
			};
		},
	};

	// Local: the catalog is in this process, so searching it is microseconds and
	// zero requests. Candidates go straight into the next step's prompt.
	const search: Step<PlanContext> = {
		name: "search",
		when: ({ id }) => !id,
		apply: (context) => {
			const { area, userText, module } = context;
			const query = area ?? userText;
			// Routing already chose the ownership boundary. The function selector
			// must see the complete module catalog: a second lexical filter here used
			// to discard the correct function when the route model chose a synonym.
			const moduleCandidates = module ? (catalog.byModule?.(module) ?? []) : [];
			const found =
				moduleCandidates.length > 0
					? moduleCandidates
					: mergeCandidates(catalog, userText, area, candidateLimit);
			const withinModule = module
				? found.filter((candidate) => candidate.module === module)
				: found;
			// The module was a hint from a fast model, not a constraint the user
			// stated. Rather than miss, the flow widens back to the whole catalog
			// and says so — a silent widening is what makes a wrong call look like
			// a considered one.
			const widened = module !== undefined && withinModule.length === 0;
			const ranked = widened ? found : withinModule;
			// What the conversation is working on admits its own functions, ahead of
			// anything the wording turned up. This is not a preference: the reply
			// that continues a piece of work ("about 5%") has no word in common with
			// the function that records it, so lexical search drops it every time and
			// the turn ends by starting the work over. `create` for something already
			// in focus goes last for the same reason — it competes with the work
			// instead of continuing it — but it stays available, because "start
			// another one" is a real request.
			const candidates = admitFocus(
				ranked,
				context.focus ?? [],
				catalog,
				widened ? undefined : module,
			).slice(0, moduleCandidates.length || candidateLimit);
			const trail: FunctionChoice[] | undefined = widened
				? context.trail?.map((choice) =>
						choice.step === "module"
							? { ...choice, note: "widened" as const }
							: choice,
					)
				: context.trail;

			if (candidates.length === 0) {
				return {
					done: { kind: "function-missed", area: query, candidates, trail },
				};
			}

			// One candidate is not worth a round-trip to pick it. It is still the
			// decision that picked the function, so it is recorded as one — with an
			// option list of one, which is exactly what the user should see.
			const only = candidates.length === 1 ? candidates[0] : undefined;
			return {
				patch: {
					area: query,
					candidates,
					...(widened ? { module: undefined } : {}),
					...(only
						? {
								id: only.id,
								trail: [
									...(trail ?? []),
									{
										step: "select",
										chosen: only.id,
										chosenLabel: only.brief,
										options: optionsOf(candidates),
										...(only.approximate
											? { note: "approximate" as const }
											: {}),
									},
								],
							}
						: { trail }),
				},
			};
		},
	};

	const select: Step<PlanContext> = {
		name: "select",
		when: ({ id }) => !id,
		// The step wants a call and nothing else, so an empty reply is worth one
		// more ask. If the second is empty too the turn still has somewhere to go:
		// `apply` reports a miss and the assistant answers in words. Throwing here
		// killed the whole turn over one flaky reply from a light model.
		retryWhenEmpty: true,
		allowEmptyAnswer: true,
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
		apply: async (context, answer) => {
			const { candidates, area, userText } = context;
			const id = readString(structured(answer, "select"), "id");
			// An id the model invented is not a function: better to miss than to
			// call something the user did not ask for.
			const chosen = id ? candidates.find((fn) => fn.id === id) : undefined;
			if (!chosen) {
				return {
					done: {
						kind: "function-missed",
						area: area ?? userText,
						candidates,
						trail: context.trail,
					},
				};
			}
			return {
				patch: {
					id: chosen.id,
					trail: record(context, {
						step: "select",
						chosen: chosen.id,
						chosenLabel: chosen.brief,
						options: optionsOf(candidates),
						...(chosen.approximate ? { note: "approximate" as const } : {}),
					}),
				},
			};
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
		when: ({ argumentsFinal }) => !argumentsFinal,
		allowEmptyAnswer: true,
		// A provider can return either no call or a provisional `{}` call. Both are
		// incomplete when the chosen function has required fields, so give the model
		// one bounded retry before the existing hard failure protects the invocation.
		retryWhen: (context, answer) => {
			const meta = context.id ? catalog.meta(context.id) : undefined;
			const schema = context.parameters ?? meta?.parameters;
			const required = schema?.required ?? [];
			if (required.length === 0) return false;
			const values = {
				...schemaDefaults(schema),
				...(context.known ?? {}),
				...(structured(answer, "call") ?? {}),
			};
			return required.some((key) => !Object.hasOwn(values, key));
		},
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
		apply: ({ id, parameters, known = {}, trail }, answer) => {
			const meta = id ? catalog.meta(id) : undefined;
			const schema = parameters ?? meta?.parameters;
			const filled = structured(answer, "call");
			// Host-known values sit between the schema's defaults and the model's
			// answer: more specific than a default, and still overridable by what
			// the user actually said this turn.
			const defaults = { ...schemaDefaults(schema), ...known };
			// The step was asked for required arguments and produced none, and the
			// schema has no defaults to stand in: calling the function now sends
			// nothing. That is how a request was created without the files that were
			// the whole point of it, and reported as a success. An optional-only
			// schema, on the other hand, explicitly permits `{}` (for example,
			// starting an interview that collects its values later).
			const values = { ...defaults, ...(filled ?? {}) };
			const missing = (schema?.required ?? []).filter(
				(key) => !Object.hasOwn(values, key),
			);
			if (meta && needsArgumentModel(schema) && missing.length > 0) {
				return {
					done: {
						kind: "function-incomplete",
						id: meta.id,
						args: values,
						missing,
						trail,
					},
				};
			}
			return {
				patch: {
					args: values,
				},
			};
		},
	};

	// Local and terminal. A failed call is a fact, not a break: the answer step
	// explains it in words (§4.7).
	const invoke: Step<PlanContext> = {
		name: "invoke",
		// `args` is what the argument step produced; `known` is what the host
		// filled when that step had nothing left to ask and was skipped.
		apply: async ({ id, args, known, trail }) => {
			const params = args ?? known ?? {};
			if (!id) {
				throw new Error(
					"[orchestrator] invoke step reached without a function id",
				);
			}
			try {
				const fact = await catalog.invoke(id, params);
				return {
					done: { kind: "function", id, args: params, fact: cap(fact), trail },
				};
			} catch (error) {
				return {
					done: {
						kind: "function",
						id,
						args: params,
						trail,
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
			const previous = merged.get(candidate.id);
			// A translated route hint can turn a language fallback into an exact
			// match. Keep the stronger result rather than preserving the first,
			// approximate copy from the raw user text.
			if (!previous || (previous.approximate && !candidate.approximate)) {
				merged.set(candidate.id, candidate);
			}
		}
	}
	const candidates = [...merged.values()];
	const exact = candidates.filter((candidate) => !candidate.approximate);
	// Approximate entries are an alternative when lexical search found nothing,
	// not extra options beside real matches. Mixing both let a model choose a
	// generic selection even when a domain-specific audience action was present.
	return (exact.length > 0 ? exact : candidates).slice(0, limit);
}
