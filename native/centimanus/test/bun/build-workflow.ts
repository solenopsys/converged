// Compile a real TS workflow (with its g-*/rt imports) into a single JS string
// for the RT VM, redirecting the generated clients to the test fixtures.

import { join } from "node:path";

const here = import.meta.dir;

// Redirect the generated clients to the fixtures, and nrpc to its source (the
// test runs outside the workspace, so node_modules resolution won't find it).
const REDIRECTS: Record<string, string> = {
	nrpc: join(here, "../../../../tools/integration/nrpc/src/index.ts"),
	"g-files/rt": join(here, "fixtures/g-files-rt.ts"),
	"g-modelconvertor/rt": join(here, "fixtures/g-modelconvertor-rt.ts"),
	"g-millingextractor/rt": join(here, "fixtures/g-millingextractor-rt.ts"),
	"g-printextractor/rt": join(here, "fixtures/g-printextractor-rt.ts"),
	"g-store/rt": join(here, "fixtures/g-store-rt.ts"),
};

/** Bundle a workflow entrypoint to an IIFE the VM can eval. */
export async function buildWorkflow(entrypoint: string): Promise<string> {
	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: "browser",
		format: "iife",
		plugins: [
			{
				name: "rt-stubs",
				setup(build) {
					build.onResolve({ filter: /^(nrpc|g-[\w-]+\/rt)$/ }, (args) => {
						const path = REDIRECTS[args.path];
						return path ? { path } : undefined;
					});
				},
			},
		],
	});

	if (!result.success) {
		throw new Error(`bun build failed:\n${result.logs.map((l) => String(l)).join("\n")}`);
	}
	return await result.outputs[0].text();
}

export const WF_FILE_ANALYSIS = join(here, "../../../../back/new/worklfows/wf-file-analysis/index.ts");
