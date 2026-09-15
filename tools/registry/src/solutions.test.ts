import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	artifactsOf,
	entriesOf,
	missingArtifacts,
	solutionCatalog,
} from "./solutions";

const roots: string[] = [];

/** A checkout with just enough of `modules/solutions` to be read. */
function project(
	solutions: Record<string, unknown>,
	mappings: unknown = {
		workflows: [
			{
				id: "request-to-order",
				name: "wf-request-to-order",
				script: "workflows/wf-request-to-order.js",
			},
		],
	},
): string {
	const root = mkdtempSync(join(tmpdir(), "registry-solutions-"));
	roots.push(root);
	const dir = join(root, "modules/solutions/solutions");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, "modules/solutions/mapping.json"),
		JSON.stringify(mappings),
	);
	for (const [name, body] of Object.entries(solutions)) {
		writeFileSync(join(dir, `${name}.json`), JSON.stringify(body));
	}
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

const production = {
	title: "Production",
	summary: "Orders and equipment.",
	keywords: ["orders", "cnc"],
	repositories: ["orders"],
	surfaces: ["orders"],
	workflows: ["request-to-order"],
	dependencies: ["security"],
};

describe("solutionCatalog", () => {
	test("carries one solution's own selection, not its dependencies'", () => {
		const root = project({
			production,
			security: {
				title: "Access",
				summary: "Accounts and sign-in.",
				repositories: ["auth"],
			},
		});

		const catalog = solutionCatalog({
			projectDir: root,
			layer: "converged",
			extends: [],
		});

		expect(catalog.solutions.production.spec.repositories).toEqual(["orders"]);
		expect(catalog.solutions.production.requires).toEqual(["security"]);
		// The dependency is a name here, not a folded-in module list: the portal
		// says "this also brings security" before anything is installed.
		expect(catalog.solutions.security.spec.repositories).toEqual(["auth"]);
	});

	test("resolves workflows through mapping.json", () => {
		const root = project({ production });
		const catalog = solutionCatalog({
			projectDir: root,
			layer: "converged",
			extends: [],
		});

		expect(catalog.solutions.production.spec.workflows).toEqual([
			{
				id: "request-to-order",
				name: "wf-request-to-order",
				script: "workflows/wf-request-to-order.js",
			},
		]);
	});

	test("refuses a workflow the mapping does not define", () => {
		const root = project({
			production: { ...production, workflows: ["not-a-workflow"] },
		});
		expect(() =>
			solutionCatalog({ projectDir: root, layer: "converged", extends: [] }),
		).toThrow(/not-a-workflow/);
	});

	test("refuses a solution with no catalogue text", () => {
		const root = project({ production: { repositories: ["orders"] } });
		expect(() =>
			solutionCatalog({ projectDir: root, layer: "converged", extends: [] }),
		).toThrow(/title/);
	});

	test("revision follows content, not build time", () => {
		const first = solutionCatalog({
			projectDir: project({ production }),
			layer: "converged",
			extends: [],
		});
		const second = solutionCatalog({
			projectDir: project({ production }),
			layer: "converged",
			extends: [],
		});
		const changed = solutionCatalog({
			projectDir: project({
				production: { ...production, summary: "Orders only." },
			}),
			layer: "converged",
			extends: [],
		});

		expect(second.revision).toBe(first.revision);
		expect(changed.revision).not.toBe(first.revision);
	});

	test("a checkout with no solutions is an empty catalogue, not a failure", () => {
		const root = mkdtempSync(join(tmpdir(), "registry-solutions-"));
		roots.push(root);
		const catalog = solutionCatalog({
			projectDir: root,
			layer: "club",
			extends: ["converged"],
		});
		expect(catalog.solutions).toEqual({});
		expect(catalog.extends).toEqual(["converged"]);
	});
});

describe("artifactsOf", () => {
	test("applies the registry's naming rule, and leaves processors alone", () => {
		expect(
			artifactsOf({
				name: "production",
				title: "Production",
				summary: "…",
				keywords: [],
				requires: [],
				spec: {
					repositories: ["orders"],
					lambdas: ["ses"],
					surfaces: ["orders"],
					processors: ["curaengine"],
					workflows: [{ name: "wf-x", script: "workflows/wf-x.js" }],
				},
			}),
		).toEqual([
			"rp-orders.js",
			"lm-ses.js",
			"sf-orders.js",
			"workflows/wf-x.js",
		]);
	});
});

describe("missingArtifacts", () => {
	test("names the solution as well as the module", () => {
		const catalog = solutionCatalog({
			projectDir: project({ production }),
			layer: "converged",
			extends: [],
		});
		const missing = missingArtifacts(
			entriesOf(catalog),
			new Set(["rp-orders.js", "workflows/wf-request-to-order.js"]),
		);
		expect(missing).toEqual([
			{ solution: "production", artifact: "sf-orders.js" },
		]);
	});
});
