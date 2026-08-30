// Build every file workflow and save it into scripts-ms via scripts.saveScript.
// Usage: bun run tools/dag/build-wf.ts (dev stack must be up on :3001)

import { join } from "node:path";
import { buildWorkflow } from "./core/build.ts";

const WORKFLOWS = ["wf-file-unpack", "wf-file-analyze", "wf-files-process"];

const token = (
	await Bun.file(
		join(import.meta.dir, "../../../confs/converged-local.env"),
	).text()
)
	.split("\n")
	.find((l) => l.startsWith("RT_SERVICE_TOKEN="))
	?.slice("RT_SERVICE_TOKEN=".length)
	.trim();
if (!token)
	throw new Error("RT_SERVICE_TOKEN not found in converged-local.env");

for (const name of WORKFLOWS) {
	const js = await buildWorkflow(
		join(import.meta.dir, "workflows", name, "index.ts"),
	);
	const res = await fetch("http://127.0.0.1:3001/services/scripts/saveScript", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ file: { path: `${name}.js`, content: js } }),
	});
	if (!res.ok) {
		throw new Error(
			`saveScript ${name} failed: ${res.status} ${await res.text()}`,
		);
	}
	console.log(`${name}.js: ${js.length} bytes -> scripts-ms`);
}
