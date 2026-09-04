// wf-files-analyze — the analysis half of intake. It takes the files an upload
// finally amounted to and runs each production model through the native
// processors, one at a time.
//
// It is the sibling of wf-files-process, not part of it: intake has to answer
// the chat immediately (the visitor is watching their files appear), while a
// CAM pass or a slice takes as long as it takes. Splitting them is what lets
// the caller start this one and not wait for it.
//
// Sequential on purpose. A processor is a single-threaded native library behind
// one handler thread (processors/interface/README.md), so firing ten models at
// one container only queues them somewhere less visible — and a serial loop is
// what makes the partial report below truthful about how far it got.

import {
	ANALYZE_DEFAULTS,
	type AnalyzeOptions,
	type ConvertedRecord,
	type EstimateRecord,
	type FlowCtx,
	isAnalyzableMime,
	loadFileMeta,
	type StepError,
} from "dag-file-steps";

const ANALYZE = "workflows/wf-file-analyze.js";

/** What wf-file-analyze reports back for one file. */
type AnalyzeReport = {
	converted: ConvertedRecord[];
	estimates: EstimateRecord[];
	errors: StepError[];
};

type Input = {
	fileIds: string[];
	owner?: string;
	processId?: string;
	collectionId?: string;
	options?: Partial<AnalyzeOptions>;
};

rt.workflow = (input: Input) => {
	if (!input?.fileIds?.length)
		throw new Error("files-analyze requires params.fileIds");

	const o: AnalyzeOptions = { ...ANALYZE_DEFAULTS, ...(input.options ?? {}) };
	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:files-analyze",
		processId: input.processId ?? __execId ?? "files-analyze",
		errors: [] as StepError[],
		converted: [],
		estimates: [],
	};
	const report = {
		analysed: [] as string[],
		skipped: [] as string[],
		converted: ctx.converted,
		estimates: ctx.estimates,
		errors: ctx.errors,
	};

	// Metadata alone decides what is a production model, so a drawing or a note
	// in the same upload is never staged and never reaches a processor.
	const models: string[] = [];
	for (const fileId of input.fileIds) {
		const meta = loadFileMeta(ctx, fileId);
		if (!meta) continue;
		if (!isAnalyzableMime(meta.metadata.fileType)) {
			report.skipped.push(fileId);
			continue;
		}
		models.push(fileId);
	}

	// One file at a time. A model that fails costs only its own estimate — the
	// rest of the upload still gets analysed.
	for (const fileId of models) {
		const analyzed = rt.subAttempt<AnalyzeReport>(`analyze:${fileId}`, ANALYZE, {
			fileId,
			collectionId: input.collectionId,
			owner: ctx.owner,
			processId: ctx.processId,
			options: o,
		});
		if (!analyzed.ok) {
			ctx.errors.push({ stage: "analyze", fileId, message: analyzed.error });
			continue;
		}
		report.analysed.push(fileId);
		for (const item of analyzed.value.converted ?? []) ctx.converted.push(item);
		for (const item of analyzed.value.estimates ?? []) ctx.estimates.push(item);
		for (const error of analyzed.value.errors ?? []) ctx.errors.push(error);
	}

	rt.log(
		`files-analyze ${ctx.processId}: analysed=${report.analysed.length} skipped=${report.skipped.length} estimates=${ctx.estimates.length} errors=${ctx.errors.length}`,
	);
	return report;
};
