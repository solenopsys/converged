// wf-file-analysis — RT flow translation of old/workflows/wf-file-analysis.ts.
//
// Flow only. Each uploaded file is staged into Valkey, classified, and routed:
// archives expand into their entries, 3D models get a GLB preview plus a CNC or
// 3D-print estimate, G-code gets a print estimate. Every heavy step is a single
// microservice call (one rt.node); file bytes travel by reference (CacheRef in
// Valkey) and never pass through this workflow. Services never call each other —
// this workflow is the coordinator. See ./contract.md for the service methods.

import { analyse } from "./analyse";
import { Run } from "./run";
import type { FileAnalysisInput } from "./types";

rt.workflow = (input: FileAnalysisInput) => {
	if (!input?.fileIds?.length) {
		throw new Error("file-analysis requires params.fileIds");
	}

	const run = new Run(input);
	run.forEachFile(analyse);
	const result = run.report();

	rt.log(
		`file-analysis ${run.options.processId}: ` +
			`inputs=${result.inputs.length} extracted=${result.extracted.length} ` +
			`estimates=${result.estimates.length} errors=${result.errors.length}`,
	);
	return result;
};
