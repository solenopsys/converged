import { basename } from "node:path";
import type { INode } from "@rt/dag-api";
import { unzipSync } from "fflate";
import { createMillingExtractorServiceClient } from "g-millingextractor";
import { createModelConvertorServiceClient } from "g-modelconvertor";
import { createPrintExtractorServiceClient } from "g-printextractor";
import {
	createStorageClients,
	readFileFromStorage,
	type StorageClients,
	saveFileToStorage,
} from "../lib/file-storage";
import {
	contentTypeForName,
	detectFileType,
	type FileDetection,
} from "../lib/file-types";

type FileAnalysisTarget = "cnc" | "print" | "generic";

type FileAnalysisOptions = {
	target?: FileAnalysisTarget;
	includeGcode?: boolean;
	convertPreview?: boolean;
	maxArchiveDepth?: number;
	definitionFileId?: string;
	definitionName?: string;
	settings?: string[];
	density?: number;
	filamentDiameter?: number;
	infillPercent?: number;
	volumetricRateMm3PerSec?: number;
	threads?: number;
};

export type FileAnalysisInput = {
	fileIds: string[];
	owner?: string;
	options?: FileAnalysisOptions;
	/** Correlation id for all files produced by this run. Defaults to a fresh
	 * UUID; the workflow passes its run id so events group under the run. */
	processId?: string;
};

type FileAnalysisFileResult = {
	fileId: string;
	name: string;
	fileType: string;
	size: number;
	detectedType: string;
	role: "input" | "extracted" | "converted" | "generated";
	parentFileId?: string;
	collectionId?: string;
	metadata?: Record<string, unknown>;
};

type FileAnalysisArtifact = {
	sourceFileId: string;
	fileId: string;
	name: string;
	fileType: string;
	kind: "preview" | "converted_model" | "gcode" | "archive_entry";
	collectionId?: string;
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

export type FileAnalysisResult = {
	inputs: FileAnalysisFileResult[];
	extracted: FileAnalysisFileResult[];
	converted: FileAnalysisArtifact[];
	estimates: FileAnalysisEstimate[];
	errors: FileAnalysisError[];
	collections: Record<string, string>; // archiveFileId -> collectionId
};

type ProcessOptions = Required<
	Pick<
		FileAnalysisOptions,
		"target" | "includeGcode" | "convertPreview" | "maxArchiveDepth"
	>
> &
	Omit<
		FileAnalysisOptions,
		"target" | "includeGcode" | "convertPreview" | "maxArchiveDepth"
	> & {
		owner: string;
		processId: string;
	};

type ProcessState = {
	clients: StorageClients;
	result: FileAnalysisResult;
	options: ProcessOptions;
};

const DEFAULT_OPTIONS: Required<
	Pick<
		FileAnalysisOptions,
		"target" | "includeGcode" | "convertPreview" | "maxArchiveDepth"
	>
> = {
	target: "generic",
	includeGcode: false,
	convertPreview: false,
	maxArchiveDepth: 2,
};

const DEFAULT_FILAMENT_DENSITY = 1.24;
const DEFAULT_FILAMENT_DIAMETER = 1.75;
const DEFAULT_INFILL_PERCENT = 20;
const DEFAULT_VOLUMETRIC_RATE_MM3_PER_SEC = 6;

type StlGeometry = {
	triangles: number;
	minX: number;
	minY: number;
	minZ: number;
	maxX: number;
	maxY: number;
	maxZ: number;
	surfaceAreaMm2: number;
	modelVolumeMm3: number;
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

function positiveNumber(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isBinaryStl(bytes: Uint8Array): boolean {
	if (bytes.length < 84) return false;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const triangles = view.getUint32(80, true);
	return 84 + triangles * 50 === bytes.length;
}

function triangleArea(
	ax: number,
	ay: number,
	az: number,
	bx: number,
	by: number,
	bz: number,
	cx: number,
	cy: number,
	cz: number,
): number {
	const ux = bx - ax;
	const uy = by - ay;
	const uz = bz - az;
	const vx = cx - ax;
	const vy = cy - ay;
	const vz = cz - az;
	const crossX = uy * vz - uz * vy;
	const crossY = uz * vx - ux * vz;
	const crossZ = ux * vy - uy * vx;
	return Math.hypot(crossX, crossY, crossZ) / 2;
}

function signedTetraVolume(
	ax: number,
	ay: number,
	az: number,
	bx: number,
	by: number,
	bz: number,
	cx: number,
	cy: number,
	cz: number,
): number {
	return (
		(ax * (by * cz - bz * cy) -
			ay * (bx * cz - bz * cx) +
			az * (bx * cy - by * cx)) /
		6
	);
}

function parseStlGeometry(bytes: Uint8Array): StlGeometry {
	let triangles = 0;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	let surfaceAreaMm2 = 0;
	let signedVolumeMm3 = 0;

	const addVertex = (x: number, y: number, z: number) => {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	};

	const addTriangle = (v: number[]) => {
		const [ax, ay, az, bx, by, bz, cx, cy, cz] = v;
		if (!v.every(Number.isFinite)) return;
		addVertex(ax, ay, az);
		addVertex(bx, by, bz);
		addVertex(cx, cy, cz);
		surfaceAreaMm2 += triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz);
		signedVolumeMm3 += signedTetraVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
		triangles += 1;
	};

	if (isBinaryStl(bytes)) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const count = view.getUint32(80, true);
		for (let i = 0; i < count; i++) {
			const offset = 84 + i * 50 + 12;
			const values: number[] = [];
			for (let j = 0; j < 9; j++) {
				values.push(view.getFloat32(offset + j * 4, true));
			}
			addTriangle(values);
		}
	} else {
		const text = new TextDecoder().decode(bytes);
		const values = [
			...text.matchAll(
				/vertex\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi,
			),
		].flatMap((match) => [
			Number(match[1]),
			Number(match[2]),
			Number(match[3]),
		]);
		for (let i = 0; i + 8 < values.length; i += 9) {
			addTriangle(values.slice(i, i + 9));
		}
	}

	if (triangles === 0) {
		throw new Error("No triangles parsed from STL model");
	}

	return {
		triangles,
		minX,
		minY,
		minZ,
		maxX,
		maxY,
		maxZ,
		surfaceAreaMm2,
		modelVolumeMm3: Math.abs(signedVolumeMm3),
	};
}

function addFileResult(
	result: FileAnalysisResult,
	role: FileAnalysisFileResult["role"],
	fileId: string,
	name: string,
	size: number,
	detection: FileDetection,
	parentFileId?: string,
	collectionId?: string,
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
		collectionId,
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
	collectionId?: string,
): Promise<void> {
	const client = createModelConvertorServiceClient({
		baseUrl: process.env.SERVICES_BASE,
	});
	const converted = await client.convert({
		sourceName,
		sourceData: sourceBytes,
		format: "glb2",
	});

	const sourceBaseName = basename(sourceName).replace(/\.[^.]+$/, "");
	for (const file of converted.files) {
		const convertedName =
			converted.files.length === 1
				? `${sourceBaseName}.glb`
				: `${sourceBaseName}-${file.name}`;
		const metadata = await saveFileToStorage(
			{
				name: convertedName,
				bytes: file.data,
				fileType: contentTypeForName(convertedName, "model/gltf-binary"),
				owner: state.options.owner,
				collectionId,
				processId: state.options.processId,
			},
			state.clients,
		);

		state.result.converted.push({
			sourceFileId,
			fileId: metadata.id,
			name: metadata.name,
			fileType: metadata.fileType,
			kind: "preview",
			collectionId,
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
	collectionId?: string,
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
				collectionId,
				processId: state.options.processId,
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
			collectionId,
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
		data: {
			...(extracted.estimate as Record<string, unknown>),
			estimator: "millingextractor",
			sourceName,
		},
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
	const estimate = await client.extractFromGcode({
		gcode: sourceBytes,
		density: state.options.density,
		filamentDiameter: state.options.filamentDiameter,
	});
	state.result.estimates.push({
		sourceFileId,
		type: "gcode",
		data: estimate as Record<string, unknown>,
	});
}

async function extractPrintSlice(
	sourceFileId: string,
	sourceName: string,
	sourceBytes: Uint8Array,
	state: ProcessState,
	collectionId?: string,
): Promise<void> {
	if (!state.options.definitionFileId) {
		throw new Error("definitionFileId is required for Cura slicing estimate");
	}

	const definition = await readFileFromStorage(
		state.options.definitionFileId,
		state.clients,
	);
	const client = createPrintExtractorServiceClient({
		baseUrl: process.env.SERVICES_BASE,
	});
	const sliced = await client.extractFromSlice({
		modelStl: sourceBytes,
		modelName: sourceName,
		definitionJson: definition.bytes,
		definitionName: state.options.definitionName ?? definition.metadata.name,
		settings: state.options.settings,
		density: state.options.density,
		filamentDiameter: state.options.filamentDiameter,
		threads: state.options.threads,
	});

	const artifactFileIds: string[] = [];
	if (state.options.includeGcode && sliced.gcode) {
		const gcodeName = `${basename(sourceName).replace(/\.[^.]+$/, "")}.gcode`;
		const metadata = await saveFileToStorage(
			{
				name: gcodeName,
				bytes: sliced.gcode,
				fileType: "text/x-gcode",
				owner: state.options.owner,
				collectionId,
				processId: state.options.processId,
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
			collectionId,
			metadata: {
				generator: "printextractor",
				hash: metadata.hash,
				fileSize: metadata.fileSize,
			},
		});
	}

	state.result.estimates.push({
		sourceFileId,
		type: "printing",
		data: {
			...(sliced.estimate as Record<string, unknown>),
			estimator: "cura-slice",
			sourceName,
		},
		artifactFileIds,
	});
}

function estimatePrintGeometry(
	sourceFileId: string,
	sourceName: string,
	sourceBytes: Uint8Array,
	state: ProcessState,
): void {
	const geometry = parseStlGeometry(sourceBytes);
	const density = positiveNumber(
		state.options.density,
		DEFAULT_FILAMENT_DENSITY,
	);
	const filamentDiameter = positiveNumber(
		state.options.filamentDiameter,
		DEFAULT_FILAMENT_DIAMETER,
	);
	const infillPercent = clamp(
		positiveNumber(state.options.infillPercent, DEFAULT_INFILL_PERCENT),
		0,
		100,
	);
	const volumetricRateMm3PerSec = positiveNumber(
		state.options.volumetricRateMm3PerSec,
		DEFAULT_VOLUMETRIC_RATE_MM3_PER_SEC,
	);
	const effectiveFillRatio = clamp(infillPercent / 100, 0.15, 1);
	const materialVolumeMm3 = geometry.modelVolumeMm3 * effectiveFillRatio;
	const weightGrams = (materialVolumeMm3 / 1000) * density;
	const filamentAreaMm2 = Math.PI * (filamentDiameter / 2) ** 2;

	state.result.estimates.push({
		sourceFileId,
		type: "printing",
		data: {
			estimator: "stl-geometry-rough",
			sourceName,
			triangles: geometry.triangles,
			dimensionsMm: {
				x: geometry.maxX - geometry.minX,
				y: geometry.maxY - geometry.minY,
				z: geometry.maxZ - geometry.minZ,
			},
			surfaceAreaMm2: geometry.surfaceAreaMm2,
			modelVolumeMm3: geometry.modelVolumeMm3,
			materialVolumeMm3,
			weightGrams,
			filamentLengthMeters: materialVolumeMm3 / filamentAreaMm2 / 1000,
			timeSeconds: materialVolumeMm3 / volumetricRateMm3PerSec,
			assumptions: {
				infillPercent,
				density,
				filamentDiameter,
				volumetricRateMm3PerSec,
				note: "Rough STL geometry estimate. Use definitionFileId for Cura slicing.",
			},
		},
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

	const collectionId = await state.clients.files.saveCollection({
		id: crypto.randomUUID(),
		name: sourceName,
		description: `Files extracted from archive: ${sourceName}`,
		owner: state.options.owner,
		createdAt: new Date().toISOString(),
	});
	state.result.collections[sourceFileId] = collectionId;

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
				collectionId,
				processId: state.options.processId,
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
			collectionId,
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
			collectionId,
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
			collectionId,
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
	collectionId?: string,
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
			await convertPreview(fileId, name, bytes, state, collectionId);
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
			await extractMilling(fileId, name, bytes, state, collectionId);
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
		detection.type === "stl"
	) {
		if (state.options.definitionFileId) {
			try {
				await extractPrintSlice(fileId, name, bytes, state, collectionId);
				return;
			} catch (error) {
				state.result.errors.push({
					fileId,
					name,
					stage: "print-slice",
					message: asErrorMessage(error),
				});
			}
		}

		try {
			estimatePrintGeometry(fileId, name, bytes, state);
		} catch (error) {
			state.result.errors.push({
				fileId,
				name,
				stage: "print-geometry",
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

export class FileAnalysisProcessFilesNode implements INode {
	constructor(public name: string) {}

	async execute(params: FileAnalysisInput): Promise<FileAnalysisResult> {
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
			processId: params.processId ?? crypto.randomUUID(),
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
				collections: {},
			},
		};

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

		return state.result;
	}
}
