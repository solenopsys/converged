import { describe, expect, test } from "bun:test";
import { createOrchestrator, createMachine, parseJsonObject } from "./index";
import { createFunctionSteps } from "./steps";
import type {
	OrchestratorCatalog,
	PlanContext,
	Step,
	StepAnswer,
	StepName,
} from "./index";

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
