import { describe, expect, test } from "bun:test";
import type { ChatDriver, ChatEvent } from "../chat-driver";
import type { StepAnswer } from "../types";
import { createConversationCatalog } from "./catalog";
import { CONVERSATION, type CallEntry, type Entry } from "./entries";
import { createConversation, type ExecutableTool } from "./conversation";

const driverOf = (turns: ChatEvent[][]): { driver: ChatDriver; sent: number } => {
	const state = { sent: 0 };
	const driver: ChatDriver = {
		async *send() {
			const turn = state.sent++;
			for (const event of turns[turn] ??
				([{ type: "response.completed", finishReason: "stop" }] as ChatEvent[])) {
				yield event;
			}
		},
	};
	return {
		driver,
		get sent() {
			return state.sent;
		},
	} as { driver: ChatDriver; sent: number };
};

const answered = (text: string): ChatEvent[] => [
	{ type: "text.delta", text },
	{ type: "response.completed", finishReason: "stop" },
];

const calls = (name: string, args: Record<string, unknown>, id: string): ChatEvent[] => [
	{ type: "tool_call.ready", callId: id, name, args },
	{ type: "response.completed", finishReason: "tool_calls" },
];

const catalogWith = (
	functions: Array<{
		id: string;
		brief: string;
		priority?: "primary" | "normal" | "secondary";
	}>,
) => {
	const catalog = createConversationCatalog();
	const invoked: Array<{ id: string; args: unknown }> = [];
	catalog.sourceRegistered({
		id: "backend",
		group: "backend",
		invoke: (key, args) => {
			invoked.push({ id: key, args });
			return { ok: true, rows: 2 };
		},
	});
	catalog.functionsPublished({ source: "backend", functions });
	return { catalog, invoked };
};

/** Steps answer with a tool call, the way a real model does. */
const planner = (replies: Record<string, Record<string, unknown>>) =>
	async ({ step, tools }: { step: string; tools: { name: string }[] }): Promise<StepAnswer> => {
		const args = replies[step];
		if (!args) throw new Error(`unexpected step ${step}`);
		return { text: "", toolCalls: [{ name: tools[0]?.name ?? step, args }] };
	};

describe("conversation entries", () => {
	test("the timeline stitches streams as references, storing text once", async () => {
		const { catalog } = catalogWith([{ id: "logs.show", brief: "Show logs" }]);
		const { driver } = driverOf([answered("here they are")]);
		const conversation = createConversation({
			catalog,
			driver,
			prompt: async (step) => `prompt:${step}`,
			ask: planner({
				route: { intent: "function", area: "logs" },
				args: {},
			}) as never,
			model: "fast",
		});

		await conversation.send("show logs");

		const timeline = conversation.entries.$timeline.getState();
		const entries = conversation.entries.$entries.getState();
		// The timeline holds ids, never copies of the text.
		expect(timeline.every((id) => typeof id === "string")).toBe(true);
		expect(timeline.map((id) => entries.get(id)?.kind)).toEqual([
			"user",
			"call",
			"assistant",
		]);

		const answer = conversation.entries.list().at(-1);
		expect(answer).toMatchObject({ kind: "assistant", text: "here they are", streaming: false });

		// The step log is a separate stream and stays out of what the user reads.
		const steps = conversation.entries.log("model:fast");
		expect(steps.some((entry) => entry.kind === "step" && entry.step === "route")).toBe(true);
		expect(
			steps
				.filter((entry): entry is Extract<Entry, { kind: "step" }> => entry.kind === "step")
				.filter((entry) => entry.step === "invoke")
				.map((entry) => entry.phase),
		).toEqual(["apply"]);
		expect(conversation.entries.log(CONVERSATION).some((e) => e.kind === "step")).toBe(false);
	});

	test("streamed text patches one entry instead of appending copies", async () => {
		const { driver } = driverOf([
			[
				{ type: "text.delta", text: "one " },
				{ type: "text.delta", text: "two" },
				{ type: "response.completed", finishReason: "stop" },
			],
		]);
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});

		await conversation.send("hi");

		const assistant = conversation.entries.list().filter((e) => e.kind === "assistant");
		expect(assistant).toHaveLength(1);
		expect(assistant[0]).toMatchObject({ text: "one two" });
	});

	test("a planning failure is shown to the user and does not fall back to the model", async () => {
		const { driver, sent } = driverOf([]);
		const conversation = createConversation({
			driver,
			prompt: async () => {
				throw new Error("forbidden");
			},
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		const errors: string[] = [];
		conversation.failed.watch((message) => void errors.push(message));

		await conversation.send("show logs");

		expect(sent).toBe(0);
		expect(errors).toEqual(["forbidden"]);
		expect(conversation.entries.list().at(-1)).toMatchObject({
			kind: "assistant",
			text: "Error: forbidden",
			streaming: false,
			local: true,
		});
	});
});

describe("conversation turn", () => {
	test("a direct tool invocation is recorded in the conversation trace", async () => {
		const { driver } = driverOf([]);
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		conversation.registerTool({
			name: "startFilesProcess",
			description: "process files",
			parameters: { type: "object", properties: {} },
			execute: async ({ fileIds }) => ({ ok: true, fileIds }),
		});

		await conversation.invokeTool("startFilesProcess", { fileIds: ["file-1"] });

		expect(conversation.entries.list()).toEqual([
			expect.objectContaining({
				kind: "call",
				name: "startFilesProcess",
				args: { fileIds: ["file-1"] },
				status: "completed",
				result: { ok: true, fileIds: ["file-1"] },
			}),
		]);
	});

	test("a direct failed tool invocation is marked failed in the trace", async () => {
		const { driver } = driverOf([]);
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		conversation.registerTool({
			name: "startFilesProcess",
			description: "process files",
			parameters: { type: "object", properties: {} },
			execute: async () => ({ ok: false, error: "compressors is unavailable" }),
		});

		await conversation.invokeTool("startFilesProcess", { fileIds: ["file-1"] });

		expect(conversation.entries.list()).toEqual([
			expect.objectContaining({
				kind: "call",
				status: "failed",
				error: "compressors is unavailable",
			}),
		]);
	});

	test("a tool call is executed and its result goes back to the model", async () => {
		const { driver } = driverOf([
			calls("readFile", { path: "a.txt" }, "call-1"),
			answered("done"),
		]);
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		conversation.registerTool({
			name: "readFile",
			description: "read",
			parameters: { type: "object", properties: {} },
			execute: async () => ({ text: "contents" }),
		} satisfies ExecutableTool);

		await conversation.send("read a.txt");

		const card = conversation.entries
			.list()
			.find((entry): entry is CallEntry => entry.kind === "call");
		expect(card).toMatchObject({
			name: "readFile",
			status: "completed",
			elapsedMs: expect.any(Number),
			result: { text: "contents" },
		});
	});

	test("repeating one call with the same arguments ends the turn", async () => {
		let call = 0;
		const driver: ChatDriver = {
			async *send() {
				for (const event of calls("spin", { mode: "hot" }, `call-${++call}`)) yield event;
			},
		};
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		conversation.registerTool({
			name: "spin",
			description: "spin",
			parameters: { type: "object", properties: {} },
			execute: async () => ({ ok: true }),
		});

		await conversation.send("spin it");

		const stopped = conversation.entries
			.list()
			.find(
				(entry): entry is CallEntry =>
					entry.kind === "call" && Boolean(entry.error?.startsWith("Turn stopped")),
			);
		expect(stopped?.status).toBe("failed");
		expect(conversation.turn.$running.getState()).toBe(false);
	});

	test("always-new calls stop at the round budget", async () => {
		let call = 0;
		const driver: ChatDriver = {
			async *send() {
				for (const event of calls("page", { offset: call }, `call-${++call}`)) yield event;
			},
		};
		const conversation = createConversation({
			driver,
			budget: { maxRounds: 3 },
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		conversation.registerTool({
			name: "page",
			description: "page",
			parameters: { type: "object", properties: {} },
			execute: async () => ({ ok: true }),
		});

		await conversation.send("page through");

		expect(call).toBeLessThanOrEqual(4);
		expect(conversation.turn.$guard.getState().rounds).toBe(3);
	});

	test("a stream error is reported without leaving the turn running", async () => {
		const driver: ChatDriver = {
			async *send() {
				yield { type: "response.error", message: "gateway is down" };
			},
		};
		const conversation = createConversation({
			driver,
			prompt: async () => undefined,
			ask: async () => ({ text: "", toolCalls: [] }),
		});
		const errors: string[] = [];
		conversation.failed.watch((message) => void errors.push(message));

		await conversation.send("hello");

		expect(errors).toEqual(["gateway is down"]);
		expect(conversation.turn.$running.getState()).toBe(false);
	});
});

describe("catalog store", () => {
	test("functions published later are searchable without rebuilding anything", () => {
		const { catalog } = catalogWith([{ id: "logs.show", brief: "Show logs" }]);
		expect(catalog.catalog.search("logs")).toHaveLength(1);

		catalog.sourceRegistered({ id: "ui", group: "ui", invoke: () => undefined });
		catalog.functionsPublished({
			source: "ui",
			functions: [{ id: "panel.open", brief: "Open the logs panel" }],
		});

		expect(catalog.catalog.search("logs").map((fn) => fn.id).sort()).toEqual([
			"logs.show",
			"panel.open",
		]);
	});

	test("a group unavailable in this host never becomes a candidate", () => {
		const { catalog } = catalogWith([{ id: "logs.show", brief: "Show logs" }]);
		catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			available: () => false,
			invoke: () => undefined,
		});
		catalog.functionsPublished({
			source: "ui",
			functions: [{ id: "panel.open", brief: "Open the logs panel" }],
		});

		expect(catalog.catalog.search("logs").map((fn) => fn.id)).toEqual(["logs.show"]);
		expect(catalog.catalog.listCategories().map((c) => c.id)).toEqual(["backend"]);
	});

	test("a primary function wins a search tie", () => {
		const { catalog } = catalogWith([
			{ id: "logs.archive", brief: "Open logs", priority: "secondary" },
			{ id: "logs.live", brief: "Open logs", priority: "primary" },
		]);

		expect(catalog.catalog.search("logs").map((fn) => fn.id)).toEqual([
			"logs.live",
			"logs.archive",
		]);
	});

	test("a turn snapshot keeps a chosen function alive while the catalog changes", () => {
		const { catalog } = catalogWith([{ id: "logs.show", brief: "Show logs" }]);
		const frozen = catalog.snapshot();

		catalog.sourceRemoved("backend");

		expect(catalog.catalog.search("logs")).toEqual([]);
		expect(frozen.search("logs").map((fn) => fn.id)).toEqual(["logs.show"]);
		expect(frozen.meta("logs.show")).toBeDefined();
	});

	test("a prefixed source keeps namesakes from colliding", () => {
		const catalog = createConversationCatalog();
		for (const group of ["ui", "backend"] as const) {
			catalog.sourceRegistered({
				id: group,
				group,
				prefix: `${group}:`,
				invoke: () => group,
			});
			catalog.functionsPublished({
				source: group,
				functions: [{ id: "open", brief: `${group} open` }],
			});
		}

		expect([...catalog.$functions.getState().keys()].sort()).toEqual([
			"backend:open",
			"ui:open",
		]);
		expect(catalog.catalog.invoke("ui:open", {})).toBe("ui");
	});
});
