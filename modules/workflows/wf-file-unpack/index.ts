// wf-file-unpack — flow only. It resolves file metadata and CacheRefs, then
// asks ms-compressors to unpack the archive. No raw bytes enter the workflow.

import {
	type FlowCtx,
	isArchive,
	loadFileForUnpack,
	type StepError,
	unpackArchive,
} from "dag-file-steps";

type Input = {
	fileId: string;
	owner?: string;
	processId?: string;
};

function fileKind(name: string, fileType: string): string {
	if (fileType === "application/zip" || name.toLowerCase().endsWith(".zip")) {
		return "zip";
	}
	const subtype = fileType.split("/")[1];
	if (subtype && subtype !== "octet-stream") return subtype.replace(/^x-/, "");
	const extension = name.split(".").pop()?.toLowerCase();
	return extension || "unknown";
}

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

	const staged = loadFileForUnpack(ctx, input.fileId);
	if (!staged) return report;
	report.name = staged.metadata.name;
	report.type = fileKind(staged.metadata.name, staged.metadata.fileType);

	if (!isArchive(staged.metadata)) {
		ctx.errors.push({
			stage: "archive",
			fileId: input.fileId,
			message: `not an archive: ${report.type}`,
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
