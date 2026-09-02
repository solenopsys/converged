#!/usr/bin/env bun

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { resolveSolutionConfig } from "../dev/src/solution";
import { solutionManifest } from "./solution-manifest";

type Options = {
	projectDir: string;
	solutionPath: string;
	platform: string;
	name?: string;
	outPath: string | null;
};

const USAGE = `Generate a Kubernetes Solution manifest from modules/solutions.

  --project-dir=<path>  Product root. Default: current directory.
  --solution=<path>     Source solution JSON. Default: modules/solutions/<project>.json.
  --platform=<name>     Platform CRD to extend. Default: solution metadata name.
  --name=<name>         Kubernetes Solution name. Default: <platform>-<solution name>.
  --out=<path>          Output file, directory, or "-" for stdout.
                       Default: solutions-<solution name>.yaml.
`;

function parseArgs(argv: string[]): Options {
	const values = new Map<string, string>();
	for (const arg of argv) {
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(USAGE);
			process.exit(0);
		}
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (!match) throw new Error(`[solution] unexpected argument: ${arg}`);
		values.set(match[1], match[2]);
	}

	const projectDir = resolve(values.get("project-dir") || process.cwd());
	const projectName = projectDir.split("/").filter(Boolean).at(-1);
	if (!projectName) throw new Error("[solution] cannot determine project name");
	const solutionPath = resolve(
		projectDir,
		values.get("solution") || `modules/solutions/${projectName}.json`,
	);
	if (!existsSync(solutionPath)) {
		throw new Error(`[solution] source solution not found: ${solutionPath}`);
	}

	const configured = resolveSolutionConfig(solutionPath).solution;
	const platform = values.get("platform")?.trim() || configured.metadata.name;
	const output = values.get("out")?.trim();
	const outPath =
		output === "-"
			? null
			: resolve(
					projectDir,
					output || `solutions-${configured.metadata.name}.yaml`,
				);

	return {
		projectDir,
		solutionPath,
		platform,
		name: values.get("name")?.trim() || undefined,
		outPath,
	};
}

const options = parseArgs(Bun.argv.slice(2));
const configured = resolveSolutionConfig(options.solutionPath).solution;
const document = stringify(solutionManifest(configured, options), {
	indent: 2,
});

if (options.outPath === null) {
	process.stdout.write(document);
} else {
	mkdirSync(dirname(options.outPath), { recursive: true });
	await Bun.write(options.outPath, document);
	console.log(`[solution] ${configured.metadata.name} -> ${options.outPath}`);
	console.log(`[solution] apply with: kubectl apply -f ${options.outPath}`);
}
