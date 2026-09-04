import { describe, expect, test } from "bun:test";
import type {
	FunctionChoice,
	OrchestratorCatalog,
	PlanContext,
	Step,
	StepAnswer,
	StepName,
} from "./index";
import { createMachine, createOrchestrator, parseJsonObject } from "./index";
import { createFunctionSteps } from "./steps";

const CATALOG: OrchestratorCatalog = {
	search: (query) =>
		query.includes("logs")
			? [
					{ id: "logs.hot.show", brief: "Show hot logs", category: "logs" },
					{ id: "logs.cold.show", brief: "Show cold logs", category: "logs" },
				]
			: [],
	listCategories: () => [{ id: "logs", count: 2 }],
	meta: (id) => ({ id, description: `describe ${id}` }),
	invoke: async (id, args) => ({ ok: true, id, args }),
};

type Reply = string | ((user: string) => string);

// The model answers with a call when it can; `text:` prefixes a prose reply, the
// fallback path light models still take.
function replyOf(
	step: string,
	reply: string,
	tools: { name: string }[],
): StepAnswer {
	if (reply.startsWith("text:")) return { text: reply.slice(5), toolCalls: [] };
	const name = tools[0]?.name ?? step;
	return { text: "", toolCalls: [{ name, args: JSON.parse(reply) }] };
}

function harness(replies: Partial<Record<string, Reply>>, catalog = CATALOG) {
	const steps: string[] = [];
	const orchestrator = createOrchestrator({
		prompt: async (step) => `prompt:${step}`,
		catalog,
		ask: async ({ step, user, tools }) => {
			steps.push(step);
			const reply = replies[step];
			if (reply === undefined) throw new Error(`unexpected step: ${step}`);
			return replyOf(
				step,
				typeof reply === "function" ? reply(user) : reply,
				tools,
			);
		},
	});
	return { orchestrator, steps };
}

describe("orchestrator", () => {
	test("a plain question stops before the catalog after one step", async () => {
		const { orchestrator, steps } = harness({ route: '{"intent":"answer"}' });

		expect(await orchestrator.plan("hello")).toEqual({ kind: "answer" });
		expect(steps).toEqual(["route"]);
	});

	test("a function request runs route, select, descriptor, args, then invokes it", async () => {
		const requiredArguments: OrchestratorCatalog = {
			...CATALOG,
			meta: (id) => ({
				id,
				description: `describe ${id}`,
				parameters: {
					type: "object",
					properties: { limit: { type: "number" } },
					required: ["limit"],
				},
			}),
		};
		const { orchestrator, steps } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: 'text:```json\n{"id":"logs.cold.show"}\n```',
				args: '{"limit":10}',
			},
			requiredArguments,
		);

		expect(await orchestrator.plan("show cold logs")).toEqual({
			kind: "function",
			id: "logs.cold.show",
			args: { limit: 10 },
			fact: { ok: true, id: "logs.cold.show", args: { limit: 10 } },
			// The choice travels with the plan: which function was taken, and what
			// else was on offer when it was.
			trail: [
				{
					step: "select",
					chosen: "logs.cold.show",
					chosenLabel: "Show cold logs",
					options: [
						{ id: "logs.hot.show", label: "Show hot logs" },
						{ id: "logs.cold.show", label: "Show cold logs" },
					],
				},
			],
		});
		// Search, descriptor loading and invoke are local, so exactly three vendor
		// calls are made.
		expect(steps).toEqual(["route", "select", "args"]);
	});

	test("one candidate skips the select call", async () => {
		const single: OrchestratorCatalog = {
			...CATALOG,
			search: () => [{ id: "logs.hot.show", brief: "Show hot logs" }],
		};
		const { orchestrator, steps } = harness(
			{ route: '{"intent":"function","area":"logs"}', args: "{}" },
			single,
		);

		const plan = await orchestrator.plan("logs");
		expect(plan.kind).toBe("function");
		expect(steps).toEqual(["route", "args"]);
	});

	test("an optional form schema still extracts values from the request", async () => {
		const optionalOnly: OrchestratorCatalog = {
			...CATALOG,
			meta: (id) => ({
				id,
				description: `describe ${id}`,
				parameters: {
					type: "object",
					properties: { param: { type: "string" } },
				},
			}),
		};
		const { orchestrator, steps } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.cold.show"}',
				args: '{"param":"draft value"}',
			},
			optionalOnly,
		);

		const plan = await orchestrator.plan("show cold logs");
		expect(plan).toMatchObject({
			kind: "function",
			id: "logs.cold.show",
			args: { param: "draft value" },
		});
		expect(steps).toEqual(["route", "select", "args"]);
	});

	test("an empty catalog does not invent a function", async () => {
		const { orchestrator, steps } = harness({
			route: '{"intent":"function","area":"billing"}',
		});

		expect(await orchestrator.plan("create an invoice")).toEqual({
			kind: "function-missed",
			area: "billing",
			candidates: [],
		});
		expect(steps).toEqual(["route"]);
	});

	test("an unknown id from select is not invoked", async () => {
		const { orchestrator } = harness({
			route: '{"intent":"function","area":"logs"}',
			select: '{"id":"orders.drop"}',
		});

		expect((await orchestrator.plan("show logs")).kind).toBe("function-missed");
	});

	test("a function failure becomes a fact rather than an exception", async () => {
		const failing: OrchestratorCatalog = {
			...CATALOG,
			invoke: () => {
				throw new Error("module is broken");
			},
		};
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.hot.show"}',
				args: "{}",
			},
			failing,
		);

		const plan = await orchestrator.plan("show logs");
		expect(plan).toMatchObject({
			kind: "function",
			id: "logs.hot.show",
			fact: { ok: false, error: "module is broken" },
		});
	});

	test("a missing step section does not invent an instruction", async () => {
		const orchestrator = createOrchestrator({
			prompt: async () => undefined,
			catalog: CATALOG,
			ask: async () => {
				throw new Error("must not ask without a prompt");
			},
		});

		expect(await orchestrator.plan("show logs")).toEqual({ kind: "answer" });
	});

	test("loads the selected function before its arguments are built", async () => {
		const loaded: string[] = [];
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.cold.show"}',
				args: "{}",
			},
			{ ...CATALOG, load: async (id) => void loaded.push(id) },
		);

		await orchestrator.plan("show logs");
		expect(loaded).toEqual(["logs.cold.show"]);
	});

	test("builds argument schema after the server-owned descriptor is loaded", async () => {
		let argsSchema = "";
		const descriptorParameters = {
			type: "object" as const,
			properties: {
				scope: { type: "string" },
				mode: { type: "string" },
				filter: {
					type: "object",
					properties: { status: { type: "object" } },
				},
			},
		};
		const selectionCatalog: OrchestratorCatalog = {
			...CATALOG,
			meta: (id) => ({
				id,
				description: "Select companies",
				parameters: {
					type: "object",
					properties: {
						scope: { type: "string" },
						mode: { type: "string" },
						filter: {
							type: "object",
							properties: {},
						},
					},
				},
			}),
			load: async () => descriptorParameters,
		};
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.cold.show"}',
				args: (input) => {
					argsSchema = input;
					return '{"scope":"new","mode":"replace","filter":{"status":{"eq":"active"}}}';
				},
			},
			selectionCatalog,
		);

		await orchestrator.plan("show active companies");
		expect(argsSchema).toContain('"status"');
	});

	test("a large result does not enter the context and returns a reference requirement", async () => {
		const fat: OrchestratorCatalog = {
			...CATALOG,
			invoke: async () => ({ rows: "x".repeat(9000) }),
		};
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.hot.show"}',
				args: "{}",
			},
			fat,
		);

		const plan = await orchestrator.plan("show logs");
		expect(plan).toMatchObject({ kind: "function", fact: { ok: false } });
		expect((plan as { fact: { error: string } }).fact.error).toContain(
			"reference",
		);
	});
});

describe("machine", () => {
	test("the model tier is selected per step within one run", async () => {
		const seen: Array<{ step: string; tier: string }> = [];
		const orchestrator = createOrchestrator({
			prompt: async (step) => `prompt:${step}`,
			catalog: CATALOG,
			tier: (step) => (step === "args" ? "heavy" : undefined),
			ask: async ({ step, tier, tools }) => {
				seen.push({ step, tier });
				const args =
					step === "route"
						? { intent: "function", area: "logs" }
						: step === "select"
							? { id: "logs.hot.show" }
							: {};
				return {
					text: "",
					toolCalls: [{ name: tools[0]?.name ?? step, args }],
				};
			},
		});

		await orchestrator.plan("show logs");
		expect(seen).toEqual([
			{ step: "route", tier: "fast" },
			{ step: "select", tier: "fast" },
			{ step: "args", tier: "heavy" },
		]);
	});

	test("a module extends the step table without changing the kernel", async () => {
		// A local step expands abbreviations before route without a vendor call.
		const expand: Step<PlanContext> = {
			name: "expand",
			apply: ({ userText }) => ({
				patch: { userText: userText.replace("log", "logs") },
			}),
		};
		const asked: string[] = [];
		const machine = createMachine<PlanContext>({
			steps: [expand, ...createFunctionSteps({ catalog: CATALOG })],
			prompt: async (step) => `prompt:${step}`,
			ask: async ({ step, user, tools }) => {
				asked.push(user);
				const args =
					step === "route"
						? { intent: "function" }
						: step === "select"
							? { id: "logs.hot.show" }
							: {};
				return {
					text: "",
					toolCalls: [{ name: tools[0]?.name ?? step, args }],
				};
			},
		});

		const plan = await machine.run({ userText: "show log", candidates: [] });
		expect(plan).toMatchObject({ kind: "function", id: "logs.hot.show" });
		expect(asked[0]).toContain("show logs");
	});

	test("a table without a terminal step fails loudly", async () => {
		const machine = createMachine<{ n: number }>({
			steps: [{ name: "noop", apply: () => ({ patch: { n: 1 } }) }],
			prompt: async () => "p",
			ask: async () => ({ text: "", toolCalls: [] }),
		});

		expect(machine.run({ n: 0 })).rejects.toThrow("without a plan");
	});

	test("a step without ask does not call the vendor", async () => {
		let asks = 0;
		const machine = createMachine<{ n: number }>({
			steps: [
				{ name: "local", apply: () => ({ patch: { n: 1 } }) },
				{ name: "end", apply: () => ({ done: { kind: "answer" } }) },
			],
			prompt: async () => "p",
			ask: async () => {
				asks++;
				return { text: "", toolCalls: [] };
			},
		});

		expect(await machine.run({ n: 0 })).toEqual({ kind: "answer" });
		expect(asks).toBe(0);
	});

	test("when skips a step completely", async () => {
		const order: string[] = [];
		const machine = createMachine<{ skip: boolean }>({
			steps: [
				{
					name: "maybe",
					when: ({ skip }) => !skip,
					apply: () => {
						order.push("maybe");
						return {};
					},
				},
				{
					name: "end",
					apply: () => {
						order.push("end");
						return { done: { kind: "answer" } };
					},
				},
			],
			prompt: async () => "p",
			ask: async () => ({ text: "", toolCalls: [] }),
		});

		await machine.run({ skip: true });
		expect(order).toEqual(["end"]);
	});

	test("step tracing is emitted on entry and completion", async () => {
		const traces: Array<{ step: string; phase: string; finished: boolean }> =
			[];
		const orchestrator = createOrchestrator({
			prompt: async () => "p",
			catalog: CATALOG,
			onStep: (trace) =>
				void traces.push({
					step: trace.step,
					phase: trace.phase,
					finished: trace.finishedAt !== undefined,
				}),
			ask: async ({ tools }) => ({
				text: "",
				toolCalls: [
					{ name: tools[0]?.name ?? "route", args: { intent: "answer" } },
				],
			}),
		});

		await orchestrator.plan("hello");
		expect(traces).toEqual([
			{ step: "route", phase: "model", finished: false },
			{ step: "route", phase: "model", finished: true },
			{ step: "route", phase: "apply", finished: false },
			{ step: "route", phase: "apply", finished: true },
		]);
	});

	test("built-in step names cover the table", () => {
		const names = createFunctionSteps({ catalog: CATALOG }).map(
			(step) => step.name,
		);
		const expected: StepName[] = [
			"route",
			"search",
			"select",
			"describe",
			"args",
			"invoke",
		];
		expect(names).toEqual(expected as string[]);
	});
});

describe("parseJsonObject", () => {
	test("extracts an object from a fence and surrounding text", () => {
		expect(parseJsonObject('{"id":"a"}')).toEqual({ id: "a" });
		expect(parseJsonObject('```json\n{"id":"b"}\n```')).toEqual({ id: "b" });
		expect(parseJsonObject('Result: {"id":"c"} complete')).toEqual({ id: "c" });
		expect(parseJsonObject('{"nested":{"x":1},"id":"d"}')).toEqual({
			nested: { x: 1 },
			id: "d",
		});
		expect(parseJsonObject('{"text":"a } b","id":"e"}')).toEqual({
			text: "a } b",
			id: "e",
		});
	});

	test("does not claim to parse invalid text", () => {
		expect(parseJsonObject("plain text")).toBeUndefined();
		expect(parseJsonObject("[1,2,3]")).toBeUndefined();
	});
});

// The section is chosen inside `route`, so narrowing the catalog costs no extra
// vendor call — and both levels end up in `trail`, which is what the transcript
// renders when a call is expanded.
describe("module routing", () => {
	const MODULAR: OrchestratorCatalog = {
		search: () => [
			{
				id: "logs.hot.show",
				brief: "Show hot logs",
				module: "mf-logs",
				moduleLabel: "Logs",
			},
			{
				id: "sales.leads.show",
				brief: "Show leads",
				module: "mf-sales",
				moduleLabel: "Sales",
			},
		],
		listCategories: () => [{ id: "logs", count: 2 }],
		listModules: () => [
			{ id: "mf-logs", label: "Logs", count: 1 },
			{ id: "mf-sales", label: "Sales", count: 1 },
		],
		meta: (id) => ({ id, description: `describe ${id}` }),
		invoke: async (id) => ({ ok: true, id }),
	};

	test("narrows candidates to the chosen module and records both choices", async () => {
		const { orchestrator, steps } = harness(
			{
				route: '{"intent":"function","module":"mf-sales","area":"leads"}',
				args: "{}",
			},
			MODULAR,
		);

		const plan = await orchestrator.plan("show me the leads");

		// One candidate survives the narrowing, so `select` is not worth a call.
		expect(steps).toEqual(["route", "args"]);
		expect(plan).toMatchObject({ kind: "function", id: "sales.leads.show" });
		expect((plan as { trail: unknown }).trail).toEqual([
			{
				step: "module",
				chosen: "mf-sales",
				chosenLabel: "Sales",
				options: [
					{ id: "mf-logs", label: "Logs" },
					{ id: "mf-sales", label: "Sales" },
				],
			},
			{
				step: "select",
				chosen: "sales.leads.show",
				chosenLabel: "Show leads",
				options: [{ id: "sales.leads.show", label: "Show leads" }],
			},
		]);
	});

	test("a module with no matches widens back to the whole catalog and says so", async () => {
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","module":"mf-geo","area":"leads"}',
				select: '{"id":"sales.leads.show"}',
				args: "{}",
			},
			{
				...MODULAR,
				listModules: () => [
					...(MODULAR.listModules?.() ?? []),
					{ id: "mf-geo", label: "Geo", count: 1 },
				],
			},
		);

		const plan = await orchestrator.plan("show me the leads");

		expect(plan).toMatchObject({ kind: "function", id: "sales.leads.show" });
		expect((plan as { trail: { note?: string }[] }).trail?.[0]).toMatchObject({
			step: "module",
			chosen: "mf-geo",
			note: "widened",
		});
	});

	test("a module the catalog does not have is ignored rather than obeyed", async () => {
		const { orchestrator } = harness(
			{
				route: '{"intent":"function","module":"mf-invented","area":"leads"}',
				select: '{"id":"logs.hot.show"}',
				args: "{}",
			},
			MODULAR,
		);

		const plan = await orchestrator.plan("show me the leads");

		expect(plan).toMatchObject({ kind: "function", id: "logs.hot.show" });
		// No module was really chosen, so nothing claims one was.
		expect((plan as { trail: FunctionChoice[] }).trail).toEqual([
			{
				step: "select",
				chosen: "logs.hot.show",
				chosenLabel: "Show hot logs",
				options: [
					{ id: "logs.hot.show", label: "Show hot logs" },
					{ id: "sales.leads.show", label: "Show leads" },
				],
			},
		]);
	});
});

// The reply that continues a piece of work does not repeat its vocabulary:
// "about 5%" has no word in common with "Record an audit answer". Lexical search
// drops that function every turn, and the run ends by starting the audit over —
// or, worse, by telling the user it saved something it never called.
describe("working context", () => {
	const AUDIT: OrchestratorCatalog = {
		// Search only ever finds the two that mention an audit by name.
		search: (query) =>
			query.toLowerCase().includes("audit")
				? [
						{
							id: "core.create:audit.audit",
							brief: "Company audit",
							targetType: "audit.audit",
							intent: "create",
						},
						{
							id: "core.show:audit.audit",
							brief: "Show Company audit",
							targetType: "audit.audit",
							intent: "read",
						},
					]
				: [],
		byTarget: (types) =>
			types.includes("audit.audit")
				? [
						{
							id: "core.execute:audit.setParameter",
							brief: "Record an audit answer",
							targetType: "audit.audit",
							intent: "mutate",
						},
						{
							id: "core.create:audit.audit",
							brief: "Company audit",
							targetType: "audit.audit",
							intent: "create",
						},
					]
				: [],
		listCategories: () => [{ id: "audit", count: 2 }],
		meta: (id) => ({ id, description: `describe ${id}` }),
		invoke: async (id, args) => ({ ok: true, id, args }),
	};

	const working = [
		{ key: "audit.audit#a1", type: "audit.audit", label: "Company audit" },
	];

	test("admits the functions of the open thing when wording finds nothing", async () => {
		const machine = createMachine<PlanContext>({
			steps: createFunctionSteps({ catalog: AUDIT }),
			prompt: async () => "p",
			ask: async ({ step, tools }) =>
				replyOf(
					step,
					step === "route"
						? '{"intent":"function","area":"loss of inquiries about 5%"}'
						: "{}",
					tools,
				),
		});

		const plan = await machine.run({
			userText: "примерно 5%",
			candidates: [],
			focus: working,
		});

		// Neither the message nor the routing hint contains a word of this
		// function's wording; the open audit is the only reason it was reachable.
		expect(plan).toMatchObject({
			kind: "function",
			id: "core.execute:audit.setParameter",
		});
	});

	test("the same message without an open audit finds nothing at all", async () => {
		const machine = createMachine<PlanContext>({
			steps: createFunctionSteps({ catalog: AUDIT }),
			prompt: async () => "p",
			ask: async ({ step, tools }) =>
				replyOf(
					step,
					step === "route"
						? '{"intent":"function","area":"loss of inquiries about 5%"}'
						: "{}",
					tools,
				),
		});

		expect(
			await machine.run({ userText: "примерно 5%", candidates: [] }),
		).toMatchObject({ kind: "function-missed" });
	});

	test("starting over is offered last, behind continuing the work", async () => {
		let offered = "";
		const machine = createMachine<PlanContext>({
			steps: createFunctionSteps({ catalog: AUDIT }),
			prompt: async () => "p",
			ask: async ({ step, user, tools }) => {
				if (step === "select") offered = user;
				return replyOf(
					step,
					step === "route"
						? '{"intent":"function","area":"audit"}'
						: step === "select"
							? '{"id":"core.execute:audit.setParameter"}'
							: "{}",
					tools,
				);
			},
		});

		await machine.run({
			userText: "audit",
			candidates: [],
			focus: working,
		});

		const lines = offered
			.split("\n")
			.filter((line) => line.startsWith("core."));
		expect(lines.at(-1)).toContain("core.create:audit.audit");
		expect(lines[0]).toContain("core.execute:audit.setParameter");
	});

	test("without an open thing nothing is admitted and search decides alone", async () => {
		let offered = "";
		const machine = createMachine<PlanContext>({
			steps: createFunctionSteps({ catalog: AUDIT }),
			prompt: async () => "p",
			ask: async ({ step, user, tools }) => {
				if (step === "select") offered = user;
				return replyOf(
					step,
					step === "route"
						? '{"intent":"function","area":"audit"}'
						: step === "select"
							? '{"id":"core.create:audit.audit"}'
							: "{}",
					tools,
				);
			},
		});

		await machine.run({ userText: "audit", candidates: [] });

		expect(offered).not.toContain("core.execute:audit.setParameter");
	});
});

// A light model answers a tool-call step with nothing often enough that it has
// to be survivable: before this, one empty reply ended the turn with a raw
// orchestrator error in the user's face.
describe("empty reply from a deciding step", () => {
	test("select is asked once more and the retry decides the turn", async () => {
		let attempt = 0;
		const { orchestrator, steps } = harness({
			route: '{"intent":"function","area":"logs"}',
			select: () => (attempt++ === 0 ? "text:" : '{"id":"logs.cold.show"}'),
			args: "{}",
		});

		expect(await orchestrator.plan("show cold logs")).toMatchObject({
			kind: "function",
			id: "logs.cold.show",
		});
		expect(steps).toEqual(["route", "select", "select", "args"]);
	});

	test("two empty replies end as a miss, not as a thrown turn", async () => {
		const { orchestrator } = harness({
			route: '{"intent":"function","area":"logs"}',
			select: "text:",
		});

		expect(await orchestrator.plan("show cold logs")).toMatchObject({
			kind: "function-missed",
		});
	});

	test("route is retried too rather than dying on one empty reply", async () => {
		let attempt = 0;
		const { orchestrator, steps } = harness({
			route: () => (attempt++ === 0 ? "text:" : '{"intent":"answer"}'),
		});

		expect(await orchestrator.plan("hello")).toEqual({ kind: "answer" });
		expect(steps).toEqual(["route", "route"]);
	});

	test("args retries an empty provisional call before invoking", async () => {
		let attempt = 0;
		const requiredArguments: OrchestratorCatalog = {
			...CATALOG,
			meta: (id) => ({
				id,
				description: `describe ${id}`,
				parameters: {
					type: "object",
					properties: { value: { type: "number" } },
					required: ["value"],
				},
			}),
		};
		const { orchestrator, steps } = harness(
			{
				route: '{"intent":"function","area":"logs"}',
				select: '{"id":"logs.cold.show"}',
				args: () => (attempt++ === 0 ? "{}" : '{"value":5}'),
			},
			requiredArguments,
		);

		expect(await orchestrator.plan("about 5")).toMatchObject({
			kind: "function",
			id: "logs.cold.show",
			args: { value: 5 },
		});
		expect(steps).toEqual(["route", "select", "args", "args"]);
	});
});

describe("empty step reply", () => {
	test("is not treated as no function required", async () => {
		const machine = createMachine<PlanContext>({
			steps: createFunctionSteps({ catalog: CATALOG }),
			prompt: async () => "p",
			ask: async () => ({ text: "   ", toolCalls: [] }),
		});

		expect(
			machine.run({ userText: "show logs", candidates: [] }),
		).rejects.toThrow('Step "route" came back empty');
	});

	test("is accepted by a step with an explicit empty-answer fallback", async () => {
		const machine = createMachine<PlanContext>({
			steps: [
				{
					name: "optional-args",
					allowEmptyAnswer: true,
					ask: () => "optional values",
					apply: (_context, answer) => ({
						done: {
							kind: "function",
							id: "mailing.send.form",
							args: {},
							fact: answer,
						},
					}),
				},
			],
			prompt: async () => "p",
			ask: async () => ({ text: "", toolCalls: [] }),
		});

		expect(
			await machine.run({ userText: "open form", candidates: [] }),
		).toEqual({
			kind: "function",
			id: "mailing.send.form",
			args: {},
			fact: { text: "", toolCalls: [] },
		});
	});
});
