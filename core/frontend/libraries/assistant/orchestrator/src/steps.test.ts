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
});
