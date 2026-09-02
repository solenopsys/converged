import { describe, expect, test } from "bun:test";
import { createMachine } from "./machine";
import { createFunctionSteps } from "./steps";
import { createFilesStep, type TurnFile } from "./steps-files";
import type { OrchestratorCatalog, PlanContext, StepAnswer } from "./types";

const MODELS: TurnFile[] = [
	{
		fileId: "wf:0",
		name: "t1_ssict_m.stl",
		fileType: "model/stl",
		primary: true,
	},
	{
		fileId: "wf:1",
		name: "locking-nut.stl",
		fileType: "model/stl",
		primary: true,
	},
	{ fileId: "wf:2", name: "drawing.pdf", fileType: "application/pdf" },
];

const catalogWith = (invoked: Array<{ id: string; args: unknown }>) =>
	({
		search: () => [
			{ id: "core.create:requests.request", brief: "Manufacturing request" },
		],
		listCategories: () => [{ id: "operator", count: 1 }],
		meta: (id: string) => ({
			id,
			brief: "Manufacturing request",
			description: "Create a request for uploaded files",
			parameters: {
				type: "object" as const,
				properties: { files: { type: "object" }, title: { type: "string" } },
			},
		}),
		invoke: (id: string, args: unknown) => {
			invoked.push({ id, args });
			return { ok: true, id: "request-1" };
		},
	}) as unknown as OrchestratorCatalog;

const requestIntent = {
	id: "core.create:requests.request",
	brief: "these files are a manufacturing order",
	arguments: (files: TurnFile[]) => ({
		files: Object.fromEntries(files.map((file) => [file.name, file.fileId])),
	}),
	complete: true,
};

const filesStep = (files: TurnFile[]) =>
	createFilesStep({
		files: () => files,
		intents: { request: requestIntent },
	});

/** The model answers the files step and nothing else is ever asked. */
const answersOnce = (intent: string) => {
	const asked: string[] = [];
	const ask = async ({
		step,
		user,
	}: {
		step: string;
		user: string;
	}): Promise<StepAnswer> => {
		asked.push(step);
		// Anything else answers "not a function", which ends the turn in words.
		if (step !== "files") return { text: "{}", toolCalls: [] };
		expect(user).toContain("t1_ssict_m.stl");
		return { text: "", toolCalls: [{ name: "files", args: { intent } }] };
	};
	return { asked, ask };
};

describe("the files step", () => {
	test("one decision fills the call and the rest of the flow is skipped", async () => {
		const invoked: Array<{ id: string; args: unknown }> = [];
		const catalog = catalogWith(invoked);
		const { asked, ask } = answersOnce("request");
		const machine = createMachine<PlanContext>({
			steps: [filesStep(MODELS), ...createFunctionSteps({ catalog })],
			ask: ask as never,
			prompt: async () => "system",
		});

		const plan = await machine.run({
			userText: "создай заявку",
			candidates: [],
		});

		// The one thing worth paying a model for is what the files are for.
		expect(asked).toEqual(["files"]);
		expect(plan).toEqual({
			kind: "function",
			id: "core.create:requests.request",
			args: {
				files: {
					"t1_ssict_m.stl": "wf:0",
					"locking-nut.stl": "wf:1",
					"drawing.pdf": "wf:2",
				},
			},
			fact: { ok: true, id: "request-1" },
		});
		expect(invoked).toHaveLength(1);
	});

	test("the identifiers never travel through the prompt", async () => {
		const seen: string[] = [];
		const machine = createMachine<PlanContext>({
			steps: [
				filesStep(MODELS),
				...createFunctionSteps({ catalog: catalogWith([]) }),
			],
			ask: (async ({ user }: { user: string }) => {
				seen.push(user);
				return { text: "{}", toolCalls: [] };
			}) as never,
			prompt: async () => "system",
		});

		await machine.run({ userText: "что это", candidates: [] });

		expect(seen[0]).toContain("t1_ssict_m.stl (model/stl) *");
		// Copying these out of a prompt is what the host does for free and what a
		// light model gets wrong.
		expect(seen[0]).not.toContain("wf:0");
	});

	test('"none" leaves the ordinary flow alone', async () => {
		const invoked: Array<{ id: string; args: unknown }> = [];
		const catalog = catalogWith(invoked);
		const { asked, ask } = answersOnce("none");
		const machine = createMachine<PlanContext>({
			steps: [filesStep(MODELS), ...createFunctionSteps({ catalog })],
			ask: ask as never,
			prompt: async () => "system",
		});

		await machine.run({ userText: "что в архиве", candidates: [] });

		// route ran, so the turn was decided the usual way.
		expect(asked).toEqual(["files", "route"]);
		expect(invoked).toEqual([]);
	});

	test("a turn without files is not asked about them", async () => {
		const asked: string[] = [];
		const machine = createMachine<PlanContext>({
			steps: [
				filesStep([]),
				...createFunctionSteps({ catalog: catalogWith([]) }),
			],
			ask: (async ({ step }: { step: string }) => {
				asked.push(step);
				return { text: "{}", toolCalls: [] };
			}) as never,
			prompt: async () => "system",
		});

		await machine.run({ userText: "привет", candidates: [] });

		expect(asked).toEqual(["route"]);
	});
});
