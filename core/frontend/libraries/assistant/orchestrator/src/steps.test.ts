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
