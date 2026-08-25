// Bundle a flow-only TS workflow into the single JS string the RT VM evals.
// The output is an IIFE with no imports left: nrpc's rt-client and the g-*/rt
// clients are dependency-light by design, so bun tree-shakes the bundle down
// to the methods the workflow actually calls.

import { join } from "node:path";

// target:"browser" (no node builtins in QuickJS) would otherwise pick nrpc's
// "browser" export, which has no rt-client — pin nrpc to its full entrypoint.
const DEFAULT_REDIRECTS: Record<string, string> = {
	nrpc: join(import.meta.dir, "../../tools/nrpc/src/rt.ts"),
};

export async function buildWorkflow(
	entrypoint: string,
	extraRedirects: Record<string, string> = {},
): Promise<string> {
	const redirects = { ...DEFAULT_REDIRECTS, ...extraRedirects };
	const keys = Object.keys(redirects);
	const plugins = keys.length
		? [
				{
					name: "dag-redirects",
					setup(build: any) {
						const filter = new RegExp(`^(${keys.map(escapeRegExp).join("|")})$`);
						build.onResolve({ filter }, (args: { path: string }) => ({
							path: redirects[args.path],
						}));
					},
				},
			]
		: [];

	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: "browser",
		format: "iife",
		plugins,
	});

	if (!result.success) {
		throw new Error(`bun build failed:\n${result.logs.map((l) => String(l)).join("\n")}`);
	}
	return await result.outputs[0].text();
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
