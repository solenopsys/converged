import { basename } from "node:path";
import { Workflow } from "@rt/engines/dag";
import { unzipSync } from "fflate";
import { createMillingExtractorServiceClient } from "g-millingextractor";
import { createModelConvertorServiceClient } from "g-modelconvertor";
import { createPrintExtractorServiceClient } from "g-printextractor";
import {
	createStorageClients,
	readFileFromStorage,
	type StorageClients,
	saveFileToStorage,
} from "./lib/file-storage";
import {
	contentTypeForName,
	detectFileType,
	type FileDetection,
} from "./lib/file-types";

type FileAnalysisTarget = "cnc" | "print" | "generic";

type FileAnalysisInput = {
	fileIds: string[];
	owner?: string;
	options?: {
		target?: FileAnalysisTarget;
		includeGcode?: boolean;
		convertPreview?: boolean;
		maxArchiveDepth?: number;
	};
};

type FileAnalysisFileResult = {
	fileId: string;
	name: string;
	fileType: string;
	size: number;
	detectedType: string;
	role: "input" | "extracted" | "converted" | "generated";
	parentFileId?: string;
	metadata?: Record<string, unknown>;
};

type FileAnalysisArtifact = {
	sourceFileId: string;
	fileId: string;
	name: string;
	fileType: string;
	kind: "preview" | "converted_model" | "gcode" | "archive_entry";
	metadata?: Record<string, unknown>;
};

type FileAnalysisEstimate = {
	sourceFileId: string;
	type: "milling" | "printing" | "gcode";
	data: Record<string, unknown>;
	artifactFileIds?: string[];
};

type FileAnalysisError = {
	fileId?: string;
	name?: string;
	stage: string;
	message: string;
};

type FileAnalysisResult = {
	inputs: FileAnalysisFileResult[];
	extracted: FileAnalysisFileResult[];
	converted: FileAnalysisArtifact[];
	estimates: FileAnalysisEstimate[];
	errors: FileAnalysisError[];
};

type ProcessOptions = Required<NonNullable<FileAnalysisInput["options"]>> & {
	owner: string;
};

type ProcessState = {
	clients: StorageClients;
	result: FileAnalysisResult;
	options: ProcessOptions;
};

const DEFAULT_OPTIONS: Required<NonNullable<FileAnalysisInput["options"]>> = {
	target: "cnc",
	includeGcode: false,
	convertPreview: true,
	maxArchiveDepth: 2,
};

function isSafeArchiveEntry(name: string): boolean {
	const normalized = name.replace(/\\/g, "/");
	if (!normalized || normalized.endsWith("/")) return false;
	if (normalized.startsWith("/") || normalized.startsWith("../")) return false;
	if (normalized.includes("/../")) return false;
	if (normalized.startsWith("__MACOSX/")) return false;
	return true;
}

function asErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function addFileResult(
	result: FileAnalysisResult,
	role: FileAnalysisFileResult["role"],
	fileId: string,
	name: string,
	size: number,
	detection: FileDetection,
	parentFileId?: string,
	metadata?: Record<string, unknown>,
): void {
	const item: FileAnalysisFileResult = {
		fileId,
		name,
		fileType: detection.mime,
		size,
		detectedType: detection.type,
		role,
		parentFileId,
		metadata,
	};

	if (role === "input") {
		result.inputs.push(item);
	} else {
		result.extracted.push(item);
	}
}

async function convertPreview(
	sourceFileId: string,
	sourceName: string,
	sourceBytes: Uint8Array,
	state: ProcessState,
): Promise<void> {
	const client = createModelConvertorServiceClient({
		baseUrl: process.env.SERVICES_BASE,
	});
	const converted = await client.convert({
		sourceName,
		sourceData: sourceBytes,
		format: "glb2",
	});

	for (const file of converted.files) {
		const metadata = await saveFileToStorage(
			{
				name: file.name,
				bytes: file.data,
				fileType: contentTypeForName(file.name, "model/gltf-binary"),
				owner: state.options.owner,
			},
			state.clients,
		);

		state.result.converted.push({
			sourceFileId,
			fileId: metadata.id,
			name: metadata.name,
			fileType: metadata.fileType,
			kind: "preview",
			metadata: {
				converter: "modelconvertor",
				format: "glb2",
				hash: metadata.hash,
				fileSize: metadata.fileSize,
			},
		});
	}
}

async function extractMilling(
	sourceFileId: string,
	sourceName: string,
	sourceBytes: Uint8Array,
	state: ProcessState,
): Promise<void> {
	const client = createMillingExtractorServiceClient({
		baseUrl: process.env.SERVICES_BASE,
	});
	const extracted = await client.extract({
		modelStl: sourceBytes,
		modelName: sourceName,
		includeGcode: state.options.includeGcode,
	});

	const artifactFileIds: string[] = [];
	if (extracted.gcode) {
		const gcodeName = `${basename(sourceName).replace(/\.[^.]+$/, "")}.gcode`;
		const metadata = await saveFileToStorage(
			{
				name: gcodeName,
				bytes: extracted.gcode,
				fileType: "text/x-gcode",
				owner: state.options.owner,
			},
			state.clients,
		);

		artifactFileIds.push(metadata.id);
		state.result.converted.push({
			sourceFileId,
			fileId: metadata.id,
			name: metadata.name,
			fileType: metadata.fileType,
			kind: "gcode",
			metadata: {
				generator: "millingextractor",
				hash: metadata.hash,
				fileSize: metadata.fileSize,
			},
		});
	}

	state.result.estimates.push({
		sourceFileId,
		type: "milling",
		data: extracted.estimate as Record<string, unknown>,
		artifactFileIds,
	});
}

async function extractGcodeEstimate(
	sourceFileId: string,
	sourceBytes: Uint8Array,
	state: ProcessState,
): Promise<void> {
	const client = createPrintExtractorServiceClient({
		baseUrl: process.env.SERVICES_BASE,
	});
	const estimate = await client.extractFromGcode({ gcode: sourceBytes });
	state.result.estimates.push({
		sourceFileId,
		type: "gcode",
		data: estimate as Record<string, unknown>,
	});
}

async function processArchive(
	sourceFileId: string,
	sourceName: string,
	sourceBytes: Uint8Array,
	depth: number,
	state: ProcessState,
): Promise<void> {
	if (depth >= state.options.maxArchiveDepth) {
		state.result.errors.push({
			fileId: sourceFileId,
			name: sourceName,
			stage: "archive",
			message: `Archive recursion depth exceeded: ${state.options.maxArchiveDepth}`,
		});
		return;
	}

	const entries = unzipSync(sourceBytes);
	for (const [entryName, entryBytes] of Object.entries(entries)) {
		if (!isSafeArchiveEntry(entryName)) continue;

		const fileName = entryName.replace(/\\/g, "/");
		const detection = detectFileType(fileName, entryBytes);
		const metadata = await saveFileToStorage(
			{
				name: fileName,
				bytes: entryBytes,
				fileType: detection.mime,
				owner: state.options.owner,
			},
			state.clients,
		);

		addFileResult(
			state.result,
			"extracted",
			metadata.id,
			metadata.name,
			metadata.fileSize,
			detection,
			sourceFileId,
			{
				sourceArchiveFileId: sourceFileId,
				hash: metadata.hash,
			},
		);

		state.result.converted.push({
			sourceFileId,
			fileId: metadata.id,
			name: metadata.name,
			fileType: metadata.fileType,
			kind: "archive_entry",
			metadata: {
				sourceArchiveName: sourceName,
				entryName,
			},
		});

		await processStoredBytes(
			metadata.id,
			metadata.name,
			entryBytes,
			detection,
			depth + 1,
			state,
		);
	}
}

async function processStoredBytes(
	fileId: string,
	name: string,
	bytes: Uint8Array,
	detection: FileDetection,
	depth: number,
	state: ProcessState,
): Promise<void> {
	if (detection.type === "zip") {
		await processArchive(fileId, name, bytes, depth, state);
		return;
	}

	if (
		state.options.convertPreview &&
		["step", "stl", "obj", "ply", "3mf"].includes(detection.type)
	) {
		try {
			await convertPreview(fileId, name, bytes, state);
		} catch (error) {
			state.result.errors.push({
				fileId,
				name,
				stage: "convert-preview",
				message: asErrorMessage(error),
			});
		}
	}

	if (state.options.target === "cnc" && detection.type === "stl") {
		try {
			await extractMilling(fileId, name, bytes, state);
		} catch (error) {
			state.result.errors.push({
				fileId,
				name,
				stage: "milling-extract",
				message: asErrorMessage(error),
			});
		}
	}

	if (
		(state.options.target === "print" || state.options.target === "generic") &&
		detection.type === "gcode"
	) {
		try {
			await extractGcodeEstimate(fileId, bytes, state);
		} catch (error) {
			state.result.errors.push({
				fileId,
				name,
				stage: "gcode-extract",
				message: asErrorMessage(error),
			});
		}
	}
}

export class FileAnalysisWorkflow extends Workflow {
	async execute(params: FileAnalysisInput): Promise<void> {
		const fileIds = Array.isArray(params?.fileIds)
			? params.fileIds.filter(
					(fileId): fileId is string =>
						typeof fileId === "string" && fileId.length > 0,
				)
			: [];

		if (fileIds.length === 0) {
			throw new Error("file-analysis requires params.fileIds");
		}

		const options: ProcessOptions = {
			...DEFAULT_OPTIONS,
			...(params.options ?? {}),
			owner: params.owner ?? "workflow:file-analysis",
		};

		const state: ProcessState = {
			clients: createStorageClients(),
			options,
			result: {
				inputs: [],
				extracted: [],
				converted: [],
				estimates: [],
				errors: [],
			},
		};

		await this.invoke("load-and-process-files", async () => {
			for (const fileId of fileIds) {
				try {
					const stored = await readFileFromStorage(fileId, state.clients);
					const detection = detectFileType(stored.metadata.name, stored.bytes);

					addFileResult(
						state.result,
						"input",
						stored.metadata.id,
						stored.metadata.name,
						stored.metadata.fileSize,
						detection,
						undefined,
						{
							hash: stored.metadata.hash,
							chunksCount: stored.chunks.length,
						},
					);

					await processStoredBytes(
						stored.metadata.id,
						stored.metadata.name,
						stored.bytes,
						detection,
						0,
						state,
					);
				} catch (error) {
					state.result.errors.push({
						fileId,
						stage: "load",
						message: asErrorMessage(error),
					});
				}
			}

			return {
				inputs: state.result.inputs.length,
				extracted: state.result.extracted.length,
				converted: state.result.converted.length,
				estimates: state.result.estimates.length,
				errors: state.result.errors.length,
			};
		});

		await this.invoke("final-result", async () => state.result);
		this.setVar("file-analysis:last-result", state.result);
	}
}

export const WORKFLOWS = [
	{ name: "file-analysis", ctor: FileAnalysisWorkflow },
];

export default FileAnalysisWorkflow;
