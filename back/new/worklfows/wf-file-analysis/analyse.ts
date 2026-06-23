// The dispatcher — the per-file flow, readable top to bottom. Each branch hands
// off to a stage; the heavy work and error handling live there.

import type { Run } from "./run";
import {
	convertPreview,
	estimateGcode,
	estimateMilling,
	estimatePrinting,
	expandArchive,
} from "./stages";
import type { StagedFile } from "./types";

/** Route one staged file to the right analysis. */
export function analyse(run: Run, file: StagedFile): void {
	switch (file.kind) {
		case "archive":
			return expandArchive(run, file);
		case "model":
			return analyseModel(run, file);
		case "gcode":
			if (run.options.target !== "cnc") estimateGcode(run, file);
			return;
		case "other":
			return;
	}
}

function analyseModel(run: Run, file: StagedFile): void {
	if (run.options.convertPreview) convertPreview(run, file);
	if (file.type !== "stl") return; // only STL yields a machining/print estimate

	if (run.options.target === "cnc") estimateMilling(run, file);
	else estimatePrinting(run, file);
}
