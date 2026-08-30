import { describe, expect, test } from "bun:test";
import { createConversation, type ChatDriver, type ChatEvent } from "orchestrator";
import { createChatStore } from "./chat-store";
import type { ChatMetadataService, ThreadsService } from "./types";

// What is left of this library: the screen's view of the conversation, and the
// dump of it into the thread. Both are derived from the orchestrator stores, so
// these tests assert they follow — never that they keep a copy.

const driverOf = (turns: ChatEvent[][]): ChatDriver => {
	let turn = 0;
	return {
		async *send() {
			for (const event of turns[turn++] ??
				([{ type: "response.completed", finishReason: "stop" }] as ChatEvent[])) {
				yield event;
			}
		},
	};
};

function harness(turns: ChatEvent[][] = []) {
	const saved: Array<{ user: string; data: string }> = [];
	const threadsService = {
		saveMessage: async ({ user, data }: { user: string; data: string }) => {
			saved.push({ user, data });
		},
		readThread: async () => [],
	} as unknown as ThreadsService;
	const metadataService = {
		recordChatMessage: async () => {},
	} as unknown as ChatMetadataService;

	const conversation = createConversation({
		driver: driverOf(turns),
		prompt: async () => undefined,
		ask: async () => ({ text: "", toolCalls: [] }),
	});

	const store = createChatStore({
		conversation,
		threadsService,
		metadataService,
		threadId: "thread-1",
	});
	return { store, conversation, saved };
}

const answered = (text: string): ChatEvent[] => [
	{ type: "text.delta", text },
	{ type: "response.completed", finishReason: "stop" },
];

describe("chat view", () => {
	test("the user's line is on screen before the answer arrives", async () => {
		const { store } = harness([answered("hi there")]);

		const turn = store.conversation.send("hello");
		// Synchronously after send: the message is already projected.
		expect(store.messages.map((message) => message.content)).toEqual(["hello"]);
		expect(store.isLoading).toBe(true);

		await turn;
		expect(store.messages.map((message) => message.content)).toEqual([
			"hello",
			"hi there",
		]);
		expect(store.isLoading).toBe(false);
	});

	test("a streaming answer is the current response, not a settled message", async () => {
		const { store, conversation } = harness();
		const seen: string[] = [];
		conversation.entries.textAppended.watch(() =>
			seen.push(store.currentResponse),
		);

		conversation.entries.appended({
			id: "a1",
			at: Date.now(),
			streams: ["conversation"],
			kind: "assistant",
			text: "",
			streaming: true,
		});
		conversation.entries.textAppended({ id: "a1", delta: "par" });
		conversation.entries.textAppended({ id: "a1", delta: "tial" });

		expect(seen).toEqual(["par", "partial"]);
		// While streaming it must not also appear among the settled messages.
		expect(store.messages).toHaveLength(0);

		conversation.entries.patched({ id: "a1", patch: { streaming: false } });
		expect(store.currentResponse).toBe("");
		expect(store.messages.map((message) => message.content)).toEqual(["partial"]);
	});

	test("a function call is projected as a card carrying its result", async () => {
		const { store, conversation } = harness([
			[
				{
					type: "tool_call.ready",
					callId: "call-1",
					name: "logs.show",
					args: { limit: 20 },
				},
				{ type: "response.completed", finishReason: "tool_calls" },
			],
			answered("here"),
		]);
		store.registerFunction("logs.show", {
			name: "logs.show",
			description: "Show logs",
			parameters: { type: "object", properties: {} },
			execute: async () => ({ items: [] }),
		});

		await conversation.send("show logs");

		const card = store.messages.find((message) => message.toolCallData);
		expect(card?.toolCallData).toMatchObject({
			toolCallId: "call-1",
			status: "completed",
			summary: "limit: 20",
			details: { args: { limit: 20 }, result: { items: [] } },
		});
	});

	test("the view holds no text of its own: it follows the entry it points at", () => {
		const { store, conversation } = harness();
		conversation.entries.appended({
			id: "u1",
			at: Date.now(),
			streams: ["conversation"],
			kind: "user",
			text: "before",
		});
		expect(store.messages[0]?.content).toBe("before");

		conversation.entries.patched({ id: "u1", patch: { text: "after" } });
		expect(store.messages[0]?.content).toBe("after");
	});
});

describe("chat persistence", () => {
	test("adds pending file IDs only to the next explicit user message", async () => {
		const { store, saved } = harness();

		store.attach({
			id: "file-1",
			name: "part.stl",
			size: 42,
			type: "model/stl",
		});
		await Bun.sleep(0);
		expect(saved).toEqual([]);

		store.send("create a request");
		await Bun.sleep(0);
		expect(saved[0]).toEqual({
			user: "user",
			data: '[FILE] id=file-1 name="part.stl" size=42 type="model/stl"\n\ncreate a request',
		});

		store.send("show requests");
		await Bun.sleep(0);
		expect(saved[1]).toEqual({ user: "user", data: "show requests" });
	});

	test("the user's line is dumped at once, the answer only when settled", async () => {
		const { conversation, saved } = harness([answered("done")]);

		await conversation.send("do it");

		expect(saved).toEqual([
			{ user: "user", data: "do it" },
			{ user: "assistant", data: "done" },
		]);
	});

	test("local lines stay on screen and out of the thread", async () => {
		const { store, saved } = harness();

		store.addLocalMessage("/functions list", "user");
		store.addLocalMessage("Functions: 12");
		store.attach({ id: "f1", name: "part.stl", size: 10 });
		await Bun.sleep(0);

		// All three are visible…
		expect(store.messages.map((message) => message.content)).toEqual([
			"/functions list",
			"Functions: 12",
			"part.stl",
		]);
		// …and none of them is a message of the conversation record: the slash
		// answer is not the model's, and the file is written as a link instead.
		expect(saved).toEqual([]);
	});

	test("a half-streamed answer never reaches the thread twice", async () => {
		const { conversation, saved } = harness();

		conversation.entries.appended({
			id: "a1",
			at: Date.now(),
			streams: ["conversation"],
			kind: "assistant",
			text: "",
			streaming: true,
		});
		conversation.entries.textAppended({ id: "a1", delta: "partial" });
		expect(saved).toEqual([]);

		conversation.entries.patched({ id: "a1", patch: { streaming: false } });
		conversation.entries.patched({ id: "a1", patch: { tokens: 5 } });
		await Bun.sleep(0);

		expect(saved).toEqual([{ user: "assistant", data: "partial" }]);
	});
});
