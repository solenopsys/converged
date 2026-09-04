import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { PROJECT_ROOT } from "../dev/src/apps";
import { resolveSolutionConfig } from "../dev/src/solution";
import { solutionManifest } from "./solution-manifest";

type ChartValues = {
	solutions?: Record<string, unknown>;
};

test("the chart bootstrap solution matches the converged product", () => {
	const configured = resolveSolutionConfig(
		resolve(PROJECT_ROOT, "modules/solutions/converged.json"),
	).solution;
	const values = parse(
		readFileSync(resolve(import.meta.dir, "chart/values.yaml"), "utf8"),
	) as ChartValues;

	expect(values.solutions?.converged).toEqual({
		repositories: configured.spec.repositories,
		lambdas: configured.spec.lambdas,
		surfaces: configured.spec.surfaces,
		processors: configured.spec.processors,
		workflows: configured.spec.workflows,
	});
});

test("renders a cluster Solution from the resolved product", () => {
	const configured = resolveSolutionConfig(
		resolve(PROJECT_ROOT, "modules/solutions/converged.json"),
	).solution;
	const manifest = solutionManifest(configured, { platform: "converged" });

	expect(manifest.metadata.name).toBe("converged-converged");
	expect(manifest.spec.platform).toBe("converged");
	expect(manifest.spec.repositories).toEqual(configured.spec.repositories);
	expect(manifest.spec.lambdas).toEqual(configured.spec.lambdas);
	expect(manifest.spec.workflows).toEqual(configured.spec.workflows);
});
