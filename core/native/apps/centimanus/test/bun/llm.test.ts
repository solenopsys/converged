import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { runOk, runWorkflow } from "./centimanus-mock";

const CHAT_TURN = readFileSync(
	`${import.meta.dir}/../../examples/workflows/wf-chat-turn.js`,
	"utf8",
);

const completion = (over: Partial<Record<string, unknown>> = {}) => ({
	provider: "openai",
	model: "gpt-test",
	text: "",
	toolCalls: [],
	finishReason: "stop",
	usage: { input: 10, output: 5 },
	...over,
});

describe("rt.llm (mock hub)", () => {
	test("plain turn: request carries provider/model/messages, reply lands in history", () => {
		const requests: any[] = [];
		const outcome = runWorkflow(
			CHAT_TURN,
			{ sessionId: "s1", text: "привет", provider: "openai", model: "gpt-test", maxTokens: 256, system: "be brief" },
			() => {
				throw new Error("no microservice call expected");
			},
			{
				llm: (request) => {
					requests.push(request);
					return completion({ text: "Здравствуйте!" });
				},
			},
		);

		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result).toEqual({ reply: "Здравствуйте!", rounds: 1 });

		expect(requests).toHaveLength(1);
		expect(requests[0].provider).toBe("openai");
		expect(requests[0].model).toBe("gpt-test");
		expect(requests[0].maxTokens).toBe(256);
		expect(requests[0].messages[0]).toEqual({ role: "system", content: "be brief" });
		expect(requests[0].messages[1]).toEqual({ role: "user", content: "привет" });

		// The turn persisted the session history to the Valkey stand-in.
		const history = JSON.parse(outcome.cache.get("chat:hist:s1")!);
		expect(history.map((m: any) => m.role)).toEqual(["user", "assistant"]);
	});

	test("tool round: llm asks for a tool, the tool answers via rt.call, second round replies", () => {
		let llmRound = 0;
		const calls: string[] = [];

		const result = runOk(
			CHAT_TURN,
			{
				sessionId: "s2",
				text: "сколько стоит фрезеровка?",
				provider: "claude",
				model: "claude-test",
				maxTokens: 512,
				system: "sales agent",
				toolsService: "pricing",
				tools: [{ name: "quote", description: "get a price", parameters: { type: "object" } }],
			},
			(service, method, params) => {
				calls.push(`${service}.${method}`);
				expect(params).toEqual({ material: "steel" });
				return { price: 100 };
			},
			{
				llm: (request) => {
					llmRound++;
					if (llmRound === 1) {
						expect(request.tools).toHaveLength(1);
						return completion({
							provider: "claude",
							model: "claude-test",
							toolCalls: [{ id: "tc-1", name: "quote", args: { material: "steel" } }],
							finishReason: "tool_use",
						});
					}
					// Second round sees the tool result in the history.
					const toolMsg = request.messages.find((m: any) => m.role === "tool");
					expect(toolMsg.toolCallId).toBe("tc-1");
					expect(JSON.parse(toolMsg.content)).toEqual({ price: 100 });
					return completion({ provider: "claude", model: "claude-test", text: "100 евро" });
				},
			},
		);

		expect(result).toEqual({ reply: "100 евро", rounds: 2 });
		expect(calls).toEqual(["pricing.quote"]);
		expect(llmRound).toBe(2);
	});

	test("memoisation: each llm round and tool call runs exactly once across replays", () => {
		let llmCalls = 0;
		runOk(
			CHAT_TURN,
			{ sessionId: "s3", text: "hi", provider: "gemini", model: "g-test", maxTokens: 64, system: "x", toolsService: "svc", tools: [{ name: "t" }] },
			() => ({ ok: true }),
			{
				llm: () => {
					llmCalls++;
					return llmCalls === 1
						? completion({ toolCalls: [{ id: "a", name: "t", args: {} }] })
						: completion({ text: "done" });
				},
			},
		);
		// The step engine replays the script many times; the hub must be hit
		// exactly twice (two rounds), never per replay.
		expect(llmCalls).toBe(2);
	});

	test("without an llm handler rt.llm fails the workflow loudly", () => {
		const outcome = runWorkflow(
			`rt.workflow = function () {
				return rt.node("x", function () {
					return rt.llm({ provider: "openai", model: "m", maxTokens: 1, messages: [{ role: "user", content: "q" }] });
				});
			};`,
			{},
			() => null,
		);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.error).toContain("rt.llm");
	});
});
