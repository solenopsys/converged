// wf-file-analyze — flow only. Analyse ONE already-stored (e.g. unpacked)
// file: stage it into Valkey, detect the type, build a GLB preview for models,
// produce a CNC or 3D-print estimate. Archives are not handled here — that is
// wf-file-unpack's job. Shared steps: dag-file-steps.

import {
	ANALYZE_DEFAULTS,
	type AnalyzeOptions,
	analyzeFile,
	type FlowCtx,
	stageFile,
} from "dag-file-steps";

type Input = {
	fileId: string;
	owner?: string;
	processId?: string;
	collectionId?: string;
	options?: Partial<AnalyzeOptions>;
};

rt.workflow = (input: Input) => {
	if (!input?.fileId) throw new Error("file-analyze requires params.fileId");

	const o: AnalyzeOptions = { ...ANALYZE_DEFAULTS, ...(input.options ?? {}) };
	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:file-analyze",
		processId: input.processId ?? __execId ?? "file-analyze",
		errors: [],
		converted: [],
		estimates: [],
	};

	const report = {
		file: undefined as Record<string, unknown> | undefined,
		converted: ctx.converted,
		estimates: ctx.estimates,
		errors: ctx.errors,
	};

	const staged = stageFile(ctx, input.fileId, input.collectionId);
	if (!staged) return report;

	report.file = {
		fileId: staged.fileId,
		name: staged.name,
		fileType: staged.mime,
		size: staged.metadata.fileSize,
		detectedType: staged.type,
		collectionId: input.collectionId,
	};

	if (staged.type === "zip") {
		ctx.errors.push({
			stage: "load",
			fileId: input.fileId,
			message: "archives are handled by wf-file-unpack",
		});
		return report;
	}

	analyzeFile(ctx, o, staged);

	rt.log(
		`file-analyze ${ctx.processId}: ${staged.name} type=${staged.type} ` +
			`estimates=${ctx.estimates.length} errors=${ctx.errors.length}`,
	);
	return report;
};
