import { describe, expect, test } from "bun:test";
import { createFunctionSteps } from "./steps";

describe("function argument step", () => {
	test("keeps user-intent candidates ahead of a wrong routing area", () => {
		const workflow = {
			id: "workflows.files-process",
			brief: "Process uploaded files",
		};
		const company = { id: "catalog.companies.show", brief: "Show companies" };
		const steps = createFunctionSteps({
			catalog: {
				search: (query) =>
					query.includes("file processing") ? [workflow] : [company],
				listCategories: () => [],
				meta: () => undefined,
				invoke: () => undefined,
			},
		});
		const search = steps.find((step) => step.name === "search");

		expect(
			search?.apply(
				{
					userText: "[FILE] part.zip - run file processing",
					area: "catalog",
					candidates: [],
				},
				undefined,
			),
		).toEqual({
			patch: {
				area: "catalog",
				candidates: [workflow, company],
			},
		});
	});

	test("extracts optional form values when a function declares properties", () => {
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => ({
					id: "mailing.send.form",
					description: "Compose an email draft.",
					parameters: {
						type: "object",
						properties: { to: { type: "string" } },
					},
				}),
				invoke: () => undefined,
			},
		});
		const args = steps.find((step) => step.name === "args");

		expect(
			args?.tools?.({
				userText: "Create an email for hello@example.com",
				candidates: [],
				id: "mailing.send.form",
			}),
		).toEqual([
			expect.objectContaining({
				name: "call",
				parameters: expect.objectContaining({
					properties: { to: { type: "string" } },
				}),
			}),
		]);
	});

	test("uses a populated call when a provider emits an empty provisional call", () => {
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => ({
					id: "mailing.send.form",
					description: "Compose an email draft.",
					parameters: {
						type: "object",
						properties: { to: { type: "string" } },
					},
				}),
				invoke: () => undefined,
			},
		});
		const args = steps.find((step) => step.name === "args");
		const context = {
			userText: "Write to bla@badf.com",
			candidates: [],
			id: "mailing.send.form",
		};

		expect(args?.ask?.(context)).toContain("Argument schema:");
		expect(
			args?.apply(context, {
				text: "",
				toolCalls: [
					{ name: "call", args: {} },
					{ name: "call", args: { to: "bla@badf.com" } },
				],
			}),
		).toEqual({ patch: { args: { to: "bla@badf.com" } } });
	});

	test("refuses to call a function with nothing when no arguments came back", () => {
		// What this prevents: the model answered "I\u2019ll package your request into
		// a manufacturing request with the uploaded files mapped" and called
		// nothing. Going on with `{}` created a request with no files at all and
		// showed it as done.
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => ({
					id: "requests.request.create",
					description: "Create a request for uploaded files.",
					parameters: {
						type: "object",
						properties: { files: { type: "object" } },
					},
				}),
				invoke: () => undefined,
			},
		});
		const args = steps.find((step) => step.name === "args");

		expect(() =>
			args?.apply(
				{
					userText: "create a request",
					candidates: [],
					id: "requests.request.create",
				},
				{ text: "I\u2019ll package your request.", toolCalls: [] },
			),
		).toThrow("produced no arguments for requests.request.create");
	});

	test("applies schema defaults when the argument model returns no call", () => {
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => ({
					id: "mailing.send.form",
					description: "Compose an email draft.",
					parameters: {
						type: "object",
						properties: { body: { type: "string", default: "Hello" } },
					},
				}),
				invoke: () => undefined,
			},
		});
		const args = steps.find((step) => step.name === "args");

		expect(
			args?.apply(
				{ userText: "Write a letter", candidates: [], id: "mailing.send.form" },
				{ text: "", toolCalls: [] },
			),
		).toEqual({ patch: { args: { body: "Hello" } } });
	});
});

describe("function invocation step", () => {
	// The screen opened, the tab was there, and the chat still said the call had
	// failed: `cap` measures the result with JSON.stringify, and a function that
	// hands back a live object — a view, an effector unit, anything holding a
	// back-reference — made that throw. The throw was caught as a failed call.
	test("a result that cannot be serialized is still a successful call", async () => {
		const live: Record<string, unknown> = { kind: "set" };
		live.self = live;
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => undefined,
				invoke: () => live,
			},
		});
		const invoke = steps.find((step) => step.name === "invoke");

		const result = await invoke?.apply(
			{
				userText: "открой список компаний",
				candidates: [],
				id: "core.show:companies.company",
				args: {},
			},
			undefined,
		);

		expect(result).toEqual({
			done: {
				kind: "function",
				id: "core.show:companies.company",
				args: {},
				fact: { ok: true, note: "Result is not serializable and was omitted" },
			},
		});
	});

	test("a failing function is still reported as a failure", async () => {
		const steps = createFunctionSteps({
			catalog: {
				search: () => [],
				listCategories: () => [],
				meta: () => undefined,
				invoke: () => {
					throw new Error("service is down");
				},
			},
		});
		const invoke = steps.find((step) => step.name === "invoke");

		expect(
			await invoke?.apply(
				{ userText: "open", candidates: [], id: "core.show:x", args: {} },
				undefined,
			),
		).toEqual({
			done: {
				kind: "function",
				id: "core.show:x",
				args: {},
				fact: { ok: false, error: "service is down" },
			},
		});
	});
});
