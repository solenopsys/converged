import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLlmCatalog } from "./object-index";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe("object index LLM metadata", () => {
	test("reads the surface llm.json alongside its object manifest", async () => {
		const root = mkdtempSync(join(tmpdir(), "object-index-llm-"));
		roots.push(root);
		writeFileSync(
			join(root, "llm.json"),
			JSON.stringify({
				actions: {
					"leads.show": {
						brief: "Show leads",
						description: "Show leads selected for a campaign",
						category: "sales",
						exposure: "user",
						priority: "primary",
					},
				},
			}),
		);

		const catalog = await readLlmCatalog(root, "sales");

		expect(catalog.actions["leads.show"]?.description).toBe(
			"Show leads selected for a campaign",
		);
	});

	test("rejects a catalog without actions", async () => {
		const root = mkdtempSync(join(tmpdir(), "object-index-llm-"));
		roots.push(root);
		writeFileSync(join(root, "llm.json"), "{}");

		await expect(readLlmCatalog(root, "sales")).rejects.toThrow(
			"llm.json must contain an actions object",
		);
	});
});
