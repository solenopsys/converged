// wf-request-analyze — the smart half of the analysis. It reads the request's
// files, decides which are production models, and delegates one file at a time
// to wf-file-analyze through rt.sub; then it writes everything the children
// produced back onto the request.
//
// The assistant only decides that a request exists. Everything here is business
// logic and runs without it.

import {
	ANALYZE_DEFAULTS,
	type AnalyzeOptions,
	addRequestFile,
	attachAnalysis,
	type ConvertedRecord,
	type EstimateRecord,
	type FlowCtx,
	isAnalyzableMime,
	loadFileMeta,
	requests,
	type StepError,
	step,
} from "dag-file-steps";

const ANALYZE = "workflows/wf-file-analyze.js";

/** What wf-file-analyze reports back for one file. */
type AnalyzeReport = {
	converted: ConvertedRecord[];
	estimates: EstimateRecord[];
	errors: StepError[];
};

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

	// Analysing one file is wf-file-analyze's whole job. A model that fails
	// only costs its own estimate — the rest of the request still gets analysed.
	for (const fileId of models) {
		const analyzed = rt.subAttempt<AnalyzeReport>(
			`analyze:${fileId}`,
			ANALYZE,
			{
				fileId,
				collectionId,
				owner: ctx.owner,
				processId: ctx.processId,
				options: o,
			},
		);
		if (!analyzed.ok) {
			ctx.errors.push({ stage: "analyze", fileId, message: analyzed.error });
			continue;
		}
		report.analysed.push(fileId);
		for (const item of analyzed.value.converted ?? []) ctx.converted.push(item);
		for (const item of analyzed.value.estimates ?? []) ctx.estimates.push(item);
		for (const error of analyzed.value.errors ?? []) ctx.errors.push(error);
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
