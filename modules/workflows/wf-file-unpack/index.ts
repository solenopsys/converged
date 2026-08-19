// wf-file-unpack — flow only. Decompress ONE uploaded archive: stage it into
// Valkey, register a collection, unzip the entries into new stored files.
// No analysis happens here — feed the returned entry ids to wf-file-analyze
// (or let wf-file-analysis cascade both). Shared steps: dag-file-steps.

import {
	type FlowCtx,
	stageFile,
	type StepError,
	unpackArchive,
} from "dag-file-steps";

type Input = {
	fileId: string;
	owner?: string;
	processId?: string;
};

rt.workflow = (input: Input) => {
	if (!input?.fileId) throw new Error("file-unpack requires params.fileId");

	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:file-unpack",
		processId: input.processId ?? __execId ?? "file-unpack",
		errors: [] as StepError[],
		converted: [],
		estimates: [],
	};

	const report = {
		fileId: input.fileId,
		name: "",
		type: "",
		collectionId: "" as string | undefined,
		entries: [] as { fileId: string; name: string }[],
		errors: ctx.errors,
	};

	const staged = stageFile(ctx, input.fileId);
	if (!staged) return report;
	report.name = staged.name;
	report.type = staged.type;

	if (staged.type !== "zip") {
		ctx.errors.push({
			stage: "archive",
			fileId: input.fileId,
			message: `not an archive: ${staged.type}`,
		});
		return report;
	}

	const unpacked = unpackArchive(ctx, staged);
	if (unpacked) {
		report.collectionId = unpacked.collectionId;
		report.entries = unpacked.entries;
	}

	rt.log(
		`file-unpack ${ctx.processId}: ${report.name} entries=${report.entries.length} errors=${ctx.errors.length}`,
	);
	return report;
};
