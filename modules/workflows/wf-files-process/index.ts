// wf-files-process — intake, and the smart half of the file pipeline. It looks
// at every incoming file and decides what to do with it; the work itself is
// delegated one file at a time to wf-file-unpack through rt.sub.
//
// It does not create a request and does not analyse anything: deciding that
// these files are a request is the assistant's call, and the analysis that
// follows is wf-request-analyze.

import {
	type FlowCtx,
	isArchive,
	isModelMime,
	loadFileMeta,
	type StepError,
} from "dag-file-steps";

const UNPACK = "workflows/wf-file-unpack.js";

type Input = {
	fileIds: string[];
	owner?: string;
	processId?: string;
};

type UnpackReport = {
	collectionId?: string;
	entries: { fileId: string; name: string }[];
	errors: StepError[];
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
			collectionId?: string;
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

		// Unpacking one archive is wf-file-unpack's whole job. One bad archive
		// must not cost us the rest of the upload, so failures come back as data.
		const unpacked = rt.subAttempt<UnpackReport>(`unpack:${fileId}`, UNPACK, {
			fileId,
			owner: ctx.owner,
			processId: ctx.processId,
		});
		if (!unpacked.ok) {
			ctx.errors.push({
				stage: "archive",
				fileId,
				message: unpacked.error,
			});
			continue;
		}
		for (const error of unpacked.value.errors ?? []) ctx.errors.push(error);
		const entries = unpacked.value.entries ?? [];
		const collectionId = unpacked.value.collectionId;
		report.extracted.push({ sourceFileId: fileId, collectionId, entries });
		if (collectionId) report.collections[fileId] = collectionId;

		for (const entry of entries) {
			const extracted = loadFileMeta(ctx, entry.fileId);
			if (!extracted) continue;
			record(
				entry.fileId,
				extracted.metadata.name,
				extracted.metadata.fileType,
				extracted.metadata.fileSize,
				collectionId,
				fileId,
			);
		}
	}

	rt.log(
		`files-process ${ctx.processId}: files=${report.files.length} contents=${report.contents.length} models=${report.modelFileIds.length} errors=${ctx.errors.length}`,
	);
	return report;
};
