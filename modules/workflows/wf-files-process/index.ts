// wf-files-process — batch intake. It unpacks archives, collects model files,
// and creates one generic request from the resulting stored file IDs.

import {
	type FlowCtx,
	isArchive,
	loadFileForUnpack,
	requests,
	type StepError,
	unpackArchive,
} from "dag-file-steps";

type Input = {
	fileIds: string[];
	owner?: string;
	processId?: string;
};

const MODEL_FILE_TYPES = new Set([
	"model/stl",
	"model/step",
	"model/obj",
	"model/ply",
	"model/3mf",
	"model/gltf-binary",
	"model/gltf+json",
]);

function addFile(
	files: Record<string, string>,
	name: string,
	fileId: string,
): void {
	const base = name || fileId;
	let key = base;
	let suffix = 2;
	while (files[key]) key = `${base} (${suffix++})`;
	files[key] = fileId;
}

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
		modelFileIds: [] as string[],
		requestId: undefined as string | undefined,
		errors: ctx.errors,
	};
	const requestFiles: Record<string, string> = {};
	const requestCollections: Record<string, string> = {};

	for (const fileId of input.fileIds) {
		const file = loadFileForUnpack(ctx, fileId);
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
			if (MODEL_FILE_TYPES.has(file.metadata.fileType)) {
				report.modelFileIds.push(fileId);
				addFile(requestFiles, file.metadata.name, fileId);
			}
			continue;
		}

		const unpacked = unpackArchive(ctx, file);
		if (!unpacked) continue;
		report.extracted.push({
			sourceFileId: fileId,
			collectionId: unpacked.collectionId,
			entries: unpacked.entries,
		});
		requestCollections[fileId] = unpacked.collectionId;
		for (const entry of unpacked.entries) {
			const extracted = loadFileForUnpack(ctx, entry.fileId);
			if (!extracted) continue;
			if (!MODEL_FILE_TYPES.has(extracted.metadata.fileType)) continue;
			report.modelFileIds.push(entry.fileId);
			addFile(requestFiles, extracted.metadata.name, entry.fileId);
		}
	}

	if (report.modelFileIds.length > 0) {
		const requestId = rt.attempt("create-request", () =>
			requests.createRequest({
				source: "workflow:files-process",
				processType: "generic",
				fields: {},
				files: requestFiles,
				collections: requestCollections,
			}),
		);
		if (requestId.ok) report.requestId = requestId.value;
		else {
			ctx.errors.push({
				stage: "request",
				fileId: report.modelFileIds[0],
				message: requestId.error,
			});
		}
	}

	rt.log(
		`files-process ${ctx.processId}: files=${report.files.length} models=${report.modelFileIds.length} request=${report.requestId ?? "none"} errors=${ctx.errors.length}`,
	);
	return report;
};
