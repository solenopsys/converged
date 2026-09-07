#!/usr/bin/env bun

/**
 * Turns an env file into the Kubernetes Secret the cluster runs on.
 *
 *   bun run secrets                                  # club/converged package script
 *   bun run core/tools/secrets/src/cli.ts \
 *     --project=club --env=../confs/prod/club.env    # directly
 *
 * This used to be `configurator secrets`, one subcommand of a tool that also
 * built manifests, Helm charts and native apps, and that reached for the
 * project's `config.json` to learn a single string — its name. That coupling is
 * why the command stopped working once the projects moved: nothing in the tree
 * has a `config.json` any more. The name is an argument here, and the tool
 * depends on nothing but the file it is pointed at.
 *
 * Output goes next to the env file by default, so `confs/prod/club.env`
 * produces `confs/prod/club-secrets.yaml`. `--out=-` writes to stdout instead,
 * for `… --out=- | kubectl apply -f -`.
 */

import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseDotEnv } from "./dotenv";
import { buildSecretData, renderSecret } from "./secret";

type Options = {
	project: string;
	envFile: string;
	namespace: string;
	secretName: string;
	/** Absolute path to write, or null for stdout. */
	outPath: string | null;
	exclude: string[];
};

const USAGE = `Generate a Kubernetes Secret from an env file.

  --project=<name>     Project the Secret belongs to. Names it \`<name>-secrets\`
                       and, unless --namespace says otherwise, targets namespace
                       <name>. Required.
  --env=<path>         Env file to read. Also spelled --env-file. Required.
  --out=<path>         Output file, or a directory to write <name>-secrets.yaml
                       into, or "-" for stdout.
                       Default: alongside the env file.
  --namespace=<ns>     Namespace. Default: the project name.
  --name=<name>        Secret name. Default: <project>-secrets.
  --exclude=<A,B>      Extra keys to leave out, on top of the deployment-managed
                       ones. Comma-separated.
  -h, --help           This text.
`;

function parseArgs(argv: string[]): Options {
	const values = new Map<string, string>();
	for (const arg of argv) {
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(USAGE);
			process.exit(0);
		}
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (!match) throw new Error(`[secrets] unexpected argument: ${arg}`);
		values.set(match[1], match[2]);
	}

	const project = values.get("project")?.trim();
	if (!project) throw new Error("[secrets] --project is required");

	// `--env` is the spelling the package scripts use: `bun run` claims
	// `--env-file` for itself when it appears before the script path, and having
	// one name that works in both positions is worth more than matching the old
	// flag exactly. Both are accepted.
	const envArg = (values.get("env") ?? values.get("env-file"))?.trim();
	if (!envArg) throw new Error("[secrets] --env=<path> is required");
	const envFile = resolve(envArg);
	if (!existsSync(envFile)) {
		throw new Error(`[secrets] env file not found: ${envFile}`);
	}

	const secretName = values.get("name")?.trim() || `${project}-secrets`;
	const outArg = values.get("out")?.trim();
	const fileName = `${secretName}.yaml`;

	let outPath: string | null;
	if (outArg === "-") {
		outPath = null;
	} else if (!outArg) {
		outPath = join(dirname(envFile), fileName);
	} else {
		const resolved = resolve(outArg);
		// A path that exists as a directory, or that is written like one, takes
		// the generated file name; anything else is the file itself.
		const isDir =
			(existsSync(resolved) && statSync(resolved).isDirectory()) ||
			outArg.endsWith("/") ||
			!basename(resolved).includes(".");
		outPath = isDir ? join(resolved, fileName) : resolved;
	}

	return {
		project,
		envFile,
		namespace: values.get("namespace")?.trim() || project,
		secretName,
		outPath,
		exclude: (values.get("exclude")?.split(",") ?? [])
			.map((key) => key.trim())
			.filter(Boolean),
	};
}

const options = parseArgs(Bun.argv.slice(2));

const env = parseDotEnv(await Bun.file(options.envFile).text());
if (Object.keys(env).length === 0) {
	throw new Error(`[secrets] no variables in ${options.envFile}`);
}

const data = buildSecretData(env, options.exclude);
if (Object.keys(data).length === 0) {
	throw new Error(
		`[secrets] every key in ${options.envFile} was excluded — nothing to write`,
	);
}

const yaml = renderSecret({
	name: options.secretName,
	namespace: options.namespace,
	data,
});

if (options.outPath === null) {
	process.stdout.write(yaml);
} else {
	mkdirSync(dirname(options.outPath), { recursive: true });
	await Bun.write(options.outPath, yaml);
	const dropped = Object.keys(env).length - Object.keys(data).length;
	// Progress, not diagnostics — so stdout, which a terminal shows unhighlighted
	// and which is free in this branch because the document went to a file. Only
	// the --out=- path above has to keep stdout clean for the pipe.
	console.log(
		`[secrets] ${options.secretName} → ${options.outPath}\n` +
			`[secrets] ${Object.keys(data).length} key(s)` +
			(dropped > 0 ? `, ${dropped} excluded` : "") +
			`, namespace ${options.namespace}`,
	);
	console.log(`[secrets] apply with: kubectl apply -f ${options.outPath}`);
}
