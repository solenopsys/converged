// wf-files-process — intake. It expands archives and classifies every incoming
// file, so the caller learns what was uploaded. It does not create a request
// and does not analyse anything: deciding that these files are a request is the
// assistant's call, and the analysis then runs as wf-request-analyze.

import {
	type FlowCtx,
	isArchive,
	isModelMime,
	loadFileMeta,
	type StepError,
	unpackArchive,
} from "dag-file-steps";

type Input = {
	fileIds: string[];
	owner?: string;
	processId?: string;
};

type IntakeFile = {
	fileId: string;
	name: string;
	fileType: string;
	size: number;
	model: boolean;
	collectionId?: string;
	sourceFileId?: string;
};

rt.workflow = (input: Input) => {
	if (!input?.fileIds?.length)
		throw new Error("files-process requires params.fileIds");

	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:files-process",
		processId: input.processId ?? __execId ?? "files-process",
		errors: [] as StepError[],
		converted: [],
		estimates: [],
	};
	const report = {
		files: [] as Array<{
			fileId: string;
			name: string;
			fileType: string;
			size: number;
			archive: boolean;
		}>,
		extracted: [] as Array<{
			sourceFileId: string;
			collectionId: string;
			entries: { fileId: string; name: string }[];
		}>,
		// Everything the upload finally amounts to, archives already expanded.
		contents: [] as IntakeFile[],
		modelFileIds: [] as string[],
		collections: {} as Record<string, string>,
		errors: ctx.errors,
	};

	const record = (
		fileId: string,
		name: string,
		fileType: string,
		size: number,
		collectionId?: string,
		sourceFileId?: string,
	): void => {
		const model = isModelMime(fileType);
		report.contents.push({
			fileId,
			name,
			fileType,
			size,
			model,
			collectionId,
			sourceFileId,
		});
		if (model) report.modelFileIds.push(fileId);
	};

	for (const fileId of input.fileIds) {
		const file = loadFileMeta(ctx, fileId);
		if (!file) continue;
		const archive = isArchive(file.metadata);
		report.files.push({
			fileId,
			name: file.metadata.name,
			fileType: file.metadata.fileType,
			size: file.metadata.fileSize,
			archive,
		});
		if (!archive) {
			record(
				fileId,
				file.metadata.name,
				file.metadata.fileType,
				file.metadata.fileSize,
			);
			continue;
		}

		const unpacked = unpackArchive(ctx, file);
		if (!unpacked) continue;
		report.extracted.push({
			sourceFileId: fileId,
			collectionId: unpacked.collectionId,
			entries: unpacked.entries,
		});
		report.collections[fileId] = unpacked.collectionId;
		for (const entry of unpacked.entries) {
			const extracted = loadFileMeta(ctx, entry.fileId);
			if (!extracted) continue;
			record(
				entry.fileId,
				extracted.metadata.name,
				extracted.metadata.fileType,
				extracted.metadata.fileSize,
				unpacked.collectionId,
				fileId,
			);
		}
	}

	rt.log(
		`files-process ${ctx.processId}: files=${report.files.length} contents=${report.contents.length} models=${report.modelFileIds.length} errors=${ctx.errors.length}`,
	);
	return report;
};
