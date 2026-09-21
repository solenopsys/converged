import { describe, expect, test } from "bun:test";
import {
	createCaseOrchestrator,
	createResonusCaseRouter,
	loadResonusCaseContext,
	type ResonusCommandTransport,
} from "./index";
import type { OrchestratorCatalog } from "./types";

const catalog = (invoked: Array<{ id: string; args: Record<string, unknown> }>): OrchestratorCatalog => ({
	search: () => [],
	listCategories: () => [],
	meta: (id) =>
		id === "surface.mail.inbox"
			? {
					id,
					brief: "Open inbox",
					parameters: {
						type: "object",
						properties: { unread: { type: "boolean" } },
					},
				}
			: undefined,
	invoke: (id, args) => {
		invoked.push({ id, args });
		return { ok: true };
	},
});

const noStream = async function* (): AsyncIterable<unknown> {};

describe("CASE surface flow", () => {
	test("maps the uniform CASE tool call to a command id", async () => {
		const requests: Array<{ method: string; payload: Record<string, unknown> }> = [];
		const transport: ResonusCommandTransport = {
			command: async () => {},
			request: async (method, payload) => {
				requests.push({ method, payload });
				return { toolCalls: [{ name: "surface.mail.inbox", args: {} }] };
			},
			stream: noStream,
		};
		const router = createResonusCaseRouter({
			transport,
			context: "club:surfaces:v1",
			language: "en",
		});

		expect(await router.route("show my inbox")).toEqual({
			command: "surface.mail.inbox",
		});
		expect(requests).toEqual([
			{
				method: "provider.complete",
				payload: {
					provider: "case",
					model: "case",
					maxTokens: 1,
					messages: [{ role: "user", content: "show my inbox" }],
					input: { context: "club:surfaces:v1", language: "en" },
				},
			},
		]);
	});

	test("uploads the compact context through the same nRPC method", async () => {
		const requests: Array<{ method: string; payload: Record<string, unknown> }> = [];
		const transport: ResonusCommandTransport = {
			command: async () => {},
			request: async (method, payload) => {
				requests.push({ method, payload });
				return {};
			},
			stream: noStream,
		};
		await loadResonusCaseContext(transport, {
			key: "workspace:en:v1",
			sections: [{ id: "sf-mailing:mailing", commands: [] }],
		});
		expect(requests).toEqual([
			{
				method: "provider.complete",
				payload: {
					provider: "case",
					model: "case",
					maxTokens: 1,
					messages: [],
					operation: "context.load",
					input: {
						key: "workspace:en:v1",
						sections: [{ id: "sf-mailing:mailing", commands: [] }],
					},
				},
			},
		]);
	});

	test("skips legacy selection and asks the model only for selected command arguments", async () => {
		const invoked: Array<{ id: string; args: Record<string, unknown> }> = [];
		const steps: string[] = [];
		const orchestrator = createCaseOrchestrator({
			catalog: catalog(invoked),
			router: { route: async () => ({ command: "surface.mail.inbox" }) },
			prompt: async (step) => {
				steps.push(step);
				return "Extract arguments";
			},
			ask: async ({ step }) => {
				steps.push(step);
				return { text: "", toolCalls: [{ name: "call", args: { unread: true } }] };
			},
		});

		expect(await orchestrator.plan("show unread inbox")).toMatchObject({
			kind: "function",
			id: "surface.mail.inbox",
			args: { unread: true },
		});
		expect(steps).toEqual(["args", "args"]);
		expect(invoked).toEqual([
			{ id: "surface.mail.inbox", args: { unread: true } },
		]);
	});

	test("treats a CASE miss as a conversational fallback without a legacy selector", async () => {
		const invoked: Array<{ id: string; args: Record<string, unknown> }> = [];
		const orchestrator = createCaseOrchestrator({
			catalog: catalog(invoked),
			router: { route: async () => undefined },
			prompt: async () => "should not run",
			ask: async () => {
				throw new Error("LLM selection must not run after a CASE miss");
			},
		});

		expect(await orchestrator.plan("what is an inbox?")).toEqual({ kind: "answer" });
		expect(invoked).toEqual([]);
	});
});
