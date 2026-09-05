import { describe, expect, test } from "bun:test";
import { createMachine } from "./machine";
import {
	chosenNumber,
	createSurfaceSteps,
	DEFAULT_COMMITS,
	positionLine,
} from "./steps-surface";
import type {
	FunctionBrief,
	OneShotAsk,
	OrchestratorCatalog,
	PlanContext,
	StepAnswer,
	ToolSpec,
} from "./types";

const sales: FunctionBrief[] = [
	{
		id: "sales.lead.select",
		brief: "Select leads",
		description: "Create or narrow a set of leads",
		module: "sf-sales",
	},
	{
		id: "sales.outreach.create",
		brief: "Create campaign",
		module: "sf-sales",
	},
];

type Call = { id: string; args: Record<string, unknown> };

function harness(options: {
	answers: Record<string, StepAnswer>;
	subtabs?: Array<{ key: string; title: string; pressed: boolean }>;
	mountFails?: boolean;
}) {
	const calls: Call[] = [];
	const catalog: OrchestratorCatalog = {
		search: () => [],
		listCategories: () => [],
		listModules: () => [
			{
				id: "sf-sales",
				label: "Sales",
				count: sales.length,
				description: "Leads, contacts, offers and campaigns",
			},
			{
				id: "sf-orders",
				label: "Orders",
				count: 1,
				description: "Customer orders and their status",
			},
		],
		byModule: (module) => (module === "sf-sales" ? sales : []),
		subtabs: () => options.subtabs ?? [],
		meta: (id) => {
			const fn = sales.find((entry) => entry.id === id);
			return fn
				? {
						id,
						brief: fn.brief,
						description: fn.description ?? fn.brief,
						parameters: { type: "object", properties: {} },
					}
				: undefined;
		},
		invoke: (id, args) => {
			calls.push({ id, args });
			if (id === DEFAULT_COMMITS.mountSurface && options.mountFails) {
				throw new Error("Unknown section");
			}
			return { ok: true };
		},
	};

	const asked: string[] = [];
	const ask: OneShotAsk = async ({ step, user }) => {
		asked.push(`${step}: ${user}`);
		return options.answers[step] ?? { text: "", toolCalls: [] };
	};

	const machine = createMachine<PlanContext>({
		steps: createSurfaceSteps({ catalog }),
		ask,
		prompt: async () => "system",
	});

	return { machine, calls, asked };
}

const choose = (n: number): StepAnswer => ({
	text: "",
	toolCalls: [{ name: "choose", args: { n } }],
});

describe("surface flow", () => {
	test("the surface step mounts the tab before the action step is asked", async () => {
		const { machine, calls } = harness({
			answers: { surface: choose(1), action: choose(1) },
		});

		await machine.run({ userText: "show me leads", candidates: [] });

		// The mount lands first: the user is looking at Sales while the second
		// step is still being decided.
		expect(calls[0]).toEqual({
			id: DEFAULT_COMMITS.mountSurface,
			args: { surface: "sf-sales" },
		});
	});

	test("a button already open is offered before the functions and ends the turn", async () => {
		const { machine, calls } = harness({
			answers: { surface: choose(1), action: choose(1) },
			subtabs: [{ key: "sales.lead.table", title: "Leads", pressed: false }],
		});

		const plan = await machine.run({
			userText: "the leads again",
			candidates: [],
		});

		expect(calls.map(({ id }) => id)).toEqual([
			DEFAULT_COMMITS.mountSurface,
			DEFAULT_COMMITS.pressSubtab,
		]);
		expect(plan).toMatchObject({
			kind: "function",
			id: DEFAULT_COMMITS.pressSubtab,
			args: { key: "sales.lead.table" },
		});
	});

	test("choosing a function continues to the state step and invokes it", async () => {
		const { machine, calls } = harness({
			answers: {
				surface: choose(1),
				action: choose(1),
				state: { text: "", toolCalls: [{ name: "call", args: {} }] },
			},
		});

		const plan = await machine.run({
			userText: "select leads",
			candidates: [],
		});

		expect(calls.map(({ id }) => id)).toEqual([
			DEFAULT_COMMITS.mountSurface,
			"sales.lead.select",
		]);
		expect(plan).toMatchObject({ kind: "function", id: "sales.lead.select" });
	});

	test("nothing fits: 0 means answer in words, and nothing is committed", async () => {
		const { machine, calls } = harness({ answers: { surface: choose(0) } });

		const plan = await machine.run({
			userText: "what can you do?",
			candidates: [],
		});

		expect(plan).toEqual({ kind: "answer" });
		expect(calls).toEqual([]);
	});

	test("already standing on the surface does not re-mount it", async () => {
		const { machine, calls } = harness({
			answers: { surface: choose(1), action: choose(1) },
		});

		await machine.run({
			userText: "select leads",
			candidates: [],
			position: { surface: "sf-sales", surfaceLabel: "Sales" },
			// The commit is skipped, but the choice still stands.
		});

		expect(calls.map(({ id }) => id)).not.toContain(
			DEFAULT_COMMITS.mountSurface,
		);
	});

	test("a refused mount costs the early feedback, not the request", async () => {
		const { machine, calls } = harness({
			answers: {
				surface: choose(1),
				action: choose(1),
				state: { text: "", toolCalls: [{ name: "call", args: {} }] },
			},
			mountFails: true,
		});

		const plan = await machine.run({
			userText: "select leads",
			candidates: [],
		});

		// The commit is what makes the choice visible a second early. Whatever the
		// later steps invoke presents into that surface anyway, so losing it must
		// not lose the turn.
		expect(plan).toMatchObject({ kind: "function", id: "sales.lead.select" });
		expect(calls.map(({ id }) => id)).toContain("sales.lead.select");
	});

	test("every step sees the position as one line", async () => {
		const { machine, asked } = harness({
			answers: { surface: choose(1), action: choose(1) },
		});

		await machine.run({
			userText: "only the active ones",
			candidates: [],
			position: {
				surface: "sf-sales",
				surfaceLabel: "Sales",
				subtab: "sales.lead.table",
				subtabLabel: "Leads",
				state: "status = active (17)",
			},
		});

		expect(asked[0]).toContain(
			"Position: Sales → Leads — status = active (17)",
		);
	});
});

describe("numbered answers", () => {
	test("reads the number from a tool call and from prose alike", () => {
		expect(chosenNumber(choose(2), 3)).toBe(2);
		expect(chosenNumber({ text: '{"n":3}', toolCalls: [] }, 3)).toBe(3);
	});

	test("out of range, zero and nonsense are all a miss", () => {
		expect(chosenNumber(choose(0), 3)).toBeUndefined();
		expect(chosenNumber(choose(4), 3)).toBeUndefined();
		expect(chosenNumber({ text: "the second one", toolCalls: [] }, 3)).toBe(
			undefined,
		);
	});
});

describe("position line", () => {
	test("nothing open says so rather than being omitted", () => {
		expect(positionLine(undefined)).toBe("Position: nothing open");
	});

	test("a surface with no button pressed is a complete position", () => {
		expect(positionLine({ surface: "sf-sales", surfaceLabel: "Sales" })).toBe(
			"Position: Sales",
		);
	});
});

const selectionSchema = {
	type: "object" as const,
	properties: {
		scope: { type: "string", enum: ["new", "current"], default: "new" },
		mode: { type: "string", enum: ["replace", "refine"], default: "replace" },
		filter: {
			type: "object",
			properties: {
				status: { type: "object" },
				AND: { type: "array" },
				OR: { type: "array" },
				NOT: { type: "object" },
			},
		},
	},
	required: ["scope", "mode"],
};

function selectionHarness(options: {
	position?: PlanContext["position"];
	filterFields?: boolean;
}) {
	let offered: ToolSpec["parameters"] | undefined;
	const fn: FunctionBrief = {
		id: "core.select:logs.entry",
		brief: "Select Logs",
		module: "sf-logs",
		targetType: "logs.entry",
	};
	const schema =
		options.filterFields === false
			? {
					...selectionSchema,
					properties: {
						...selectionSchema.properties,
						filter: { type: "object", properties: { AND: { type: "array" } } },
					},
				}
			: selectionSchema;
	const catalog: OrchestratorCatalog = {
		search: () => [],
		listCategories: () => [],
		listModules: () => [{ id: "sf-logs", label: "Logs", count: 1 }],
		byModule: () => [fn],
		subtabs: () => [],
		meta: () => ({
			id: fn.id,
			brief: fn.brief,
			description: fn.brief,
			parameters: schema,
		}),
		invoke: () => ({ ok: true }),
	};
	const machine = createMachine<PlanContext>({
		steps: createSurfaceSteps({ catalog }),
		ask: async ({ step, tools }) => {
			if (step === "state") offered = tools[0]?.parameters;
			return step === "state"
				? { text: "", toolCalls: [{ name: "call", args: {} }] }
				: choose(1);
		},
		prompt: async () => "system",
	});
	return {
		run: () =>
			machine.run({
				userText: "открой логи",
				candidates: [],
				...(options.position ? { position: options.position } : {}),
			}),
		schema: () => offered,
	};
}

describe("the state step is never asked an impossible question", () => {
	test("with nothing of this type open, `current` is not on the table", async () => {
		const h = selectionHarness({});
		await h.run();

		// "No active set selection to update" and "Active selection has type
		// assistants.chat, expected logs.entry" were both the model choosing
		// `current` when it could not have known better. Now it cannot choose it.
		const scope = h.schema()?.properties.scope as { enum: string[] };
		const mode = h.schema()?.properties.mode as { enum: string[] };
		expect(scope.enum).toEqual(["new"]);
		expect(mode.enum).toEqual(["replace"]);
	});

	test("standing on a set of the same type keeps `current` available", async () => {
		const h = selectionHarness({
			position: {
				surface: "sf-logs",
				surfaceLabel: "Logs",
				subtab: "set:logs.entry",
				type: "logs.entry",
			},
		});
		await h.run();

		const scope = h.schema()?.properties.scope as { enum: string[] };
		expect(scope.enum).toEqual(["new", "current"]);
	});

	test("a selection with no filter fields does not offer a filter to invent", async () => {
		const h = selectionHarness({ filterFields: false });
		await h.run();

		// An empty `filter` object is what produced {"chat_type":{"EQ":...}} —
		// fields the service has never heard of.
		expect(h.schema()?.properties.filter).toBeUndefined();
	});
});
