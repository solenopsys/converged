// wf-request-analyze — the analysis DAG for one request. It reads the request's
// files, analyses every production model (GLB preview + CNC/print estimate, both
// in ptah containers) and writes the result back onto the request.
//
// The assistant only decides that a request exists; this workflow is the
// business logic and runs without it. Analysing one file is wf-file-analyze's
// atomic job — this workflow composes that same step once per model file.

import {
	ANALYZE_DEFAULTS,
	type AnalyzeOptions,
	addRequestFile,
	analyzeFile,
	attachAnalysis,
	type FlowCtx,
	isAnalyzableMime,
	loadFileMeta,
	requests,
	type StepError,
	stageFile,
	step,
} from "dag-file-steps";

type Input = {
	requestId: string;
	owner?: string;
	processId?: string;
	options?: Partial<AnalyzeOptions>;
};

rt.workflow = (input: Input) => {
	if (!input?.requestId)
		throw new Error("request-analyze requires params.requestId");

	const o: AnalyzeOptions = { ...ANALYZE_DEFAULTS, ...(input.options ?? {}) };
	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:request-analyze",
		processId: input.processId ?? __execId ?? "request-analyze",
		errors: [] as StepError[],
		converted: [],
		estimates: [],
	};
	const report = {
		requestId: input.requestId,
		analysed: [] as string[],
		converted: ctx.converted,
		estimates: ctx.estimates,
		attached: false,
		errors: ctx.errors,
	};

	const model = step(
		ctx,
		"request",
		`request:${input.requestId}`,
		input.requestId,
		() => requests.getRequestModel(input.requestId),
	);
	if (!model) return report;

	// The request carries display name -> fileId. Metadata is enough to tell a
	// production model from a drawing or a note, so only models get staged.
	const files = model.files ?? {};
	const collectionId = firstCollection(model.collections);
	const models: string[] = [];
	for (const name of Object.keys(files)) {
		const fileId = files[name];
		const meta = loadFileMeta(ctx, fileId);
		if (!meta) continue;
		if (!isAnalyzableMime(meta.metadata.fileType)) continue;
		models.push(fileId);
	}

	for (const fileId of models) {
		const staged = stageFile(ctx, fileId, collectionId);
		if (!staged) continue;
		report.analysed.push(fileId);
		analyzeFile(ctx, o, staged);
	}

	// Previews become request files so the detail view can render each model.
	const previewFiles: Record<string, string> = {};
	for (const artifact of ctx.converted) {
		if (artifact.kind !== "preview") continue;
		addRequestFile(previewFiles, artifact.name, artifact.fileId);
	}

	report.attached = Boolean(attachAnalysis(ctx, input.requestId, previewFiles));

	rt.log(
		`request-analyze ${ctx.processId}: request=${input.requestId} analysed=${report.analysed.length} estimates=${ctx.estimates.length} errors=${ctx.errors.length}`,
	);
	return report;
};

/** Extracted archive entries all share one collection; previews join it too. */
function firstCollection(
	collections: Record<string, string> | undefined,
): string | undefined {
	if (!collections) return undefined;
	const keys = Object.keys(collections);
	return keys.length ? collections[keys[0]] : undefined;
}
