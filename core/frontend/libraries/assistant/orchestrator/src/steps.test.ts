import { describe, expect, test } from "bun:test";
import { createFunctionSteps } from "./steps";

describe("function argument step", () => {
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
