// dag-file-steps — the shared flow pieces of the file workflows:
// wf-file-unpack (decompress an archive), wf-file-analyze (analyse one file),
// wf-files-process (the batch coordinator). Flow only and synchronous:
// every side effect is exactly one service call inside one rt.attempt node,
// heavy bytes always travel by CacheRef. Service methods: see the workflows'
// contract.md.

import { contractClient } from "dag-core";
import type { CompressedChunk } from "g-compressors/rt";
import type { FileCollection, FileMetadata, UUID } from "g-files/rt";
import type {
	RequestId,
	RequestInput,
	RequestModel,
	RequestModelPatch,
} from "g-requests/rt";
import type { CacheRef } from "g-store/rt";

export type { CacheRef };

export const files = contractClient<{
	get(id: UUID): FileMetadata;
	getChunks(id: UUID): { hash: string; chunkNumber: number }[];
	save(file: FileMetadata, processId?: string): UUID;
	saveChunk(chunk: {
		fileId: UUID;
		hash: string;
		chunkNumber: number;
		chunkSize: number;
		createdAt: string;
	}): string;
	materialize(fileId: UUID): { ref: CacheRef; metadata: FileMetadata };
	detectType(input: { ref: CacheRef; name: string }): {
		type: string;
		mime: string;
	};
	persist(input: {
		ref: CacheRef;
		name: string;
		fileType: string;
		owner: string;
		collectionId?: UUID;
		processId?: string;
	}): FileMetadata;
	saveCollection(collection: FileCollection): UUID;
}>("files", {
	get: ["id"],
	getChunks: ["id"],
	save: ["file", "processId"],
	saveChunk: ["chunk"],
	materialize: ["fileId"],
	detectType: ["input"],
	persist: ["input"],
	saveCollection: ["collection"],
});

export const store = contractClient<{
	getWithMeta(hash: string): {
		dataRef: CacheRef;
		compression: "none" | "deflate" | "gzip" | "brotli";
		originalSize: number;
	};
	save(
		dataRef: CacheRef,
		originalSize?: number,
		compression?: "none" | "deflate" | "gzip" | "brotli",
		owner?: string,
	): string;
}>("store", {
	getWithMeta: ["hash"],
	save: ["dataRef", "originalSize", "compression", "owner"],
});

export const compressors = contractClient<{
	unpack(input: { name: string; chunks: CompressedChunk[] }): {
		entries: Array<{
			name: string;
			fileType: string;
			hash: string;
			fileSize: number;
			chunks: Array<{
				ref: CacheRef;
				compression: "none" | "deflate" | "gzip" | "brotli";
				originalSize: number;
			}>;
		}>;
	};
}>("compressors", { unpack: ["input"] });

export const requests = contractClient<{
	createRequest(input: RequestInput): RequestId;
	getRequestModel(id: RequestId): RequestModel;
	applyRequestUpdate(
		id: RequestId,
		patch: RequestModelPatch,
		actor: string,
		comment?: string,
	): RequestModel;
}>("requests", {
	createRequest: ["input"],
	getRequestModel: ["id"],
	applyRequestUpdate: ["id", "patch", "actor", "comment"],
});

export const models = contractClient<{
	convert(input: { fileId: UUID; sourceName?: string; format?: string }): {
		files: { name: string; ref: CacheRef }[];
	};
}>("modelconvertor", { convert: ["input"] });

export type Estimate = Record<string, unknown>;

export type OutputRef = { cacheKey: string; sizeBytes?: number };

export const ptah = contractClient<{
	analyze(
		plugin: string,
		task: Record<string, unknown>,
		inputs?: Record<string, string>,
		outputs?: string[],
	): { result: Estimate; outputs: Record<string, OutputRef> };
}>("ptah", { analyze: ["plugin", "task", "inputs", "outputs"] });

export const MODEL_TYPES = ["step", "stl", "obj", "ply", "3mf"];

/** Mime types that make a stored file a 3D model. MODEL_TYPES above is the
 * *detected* kind; these are what `files.get` reports before anything has been
 * staged, so intake can classify a file without materializing it. */
const MODEL_MIME_TYPES = [
	"model/stl",
	"model/step",
	"model/obj",
	"model/ply",
	"model/3mf",
	"model/gltf-binary",
	"model/gltf+json",
];

/** Source formats an estimate can be produced from. glTF is deliberately absent:
 * it is what the preview converter *emits*, so treating it as an input would make
 * a second analysis run pick up the previews the first run just created. */
const ANALYZABLE_MIME_TYPES = [
	"model/stl",
	"model/step",
	"model/obj",
	"model/ply",
	"model/3mf",
];

export function isModelMime(fileType: string): boolean {
	return MODEL_MIME_TYPES.indexOf(fileType) >= 0;
}

export function isAnalyzableMime(fileType: string): boolean {
	return ANALYZABLE_MIME_TYPES.indexOf(fileType) >= 0;
}

export const ANALYZE_DEFAULTS = {
	target: "cnc" as "cnc" | "print" | "generic",
	includeGcode: false,
	convertPreview: true,
};

export type AnalyzeOptions = typeof ANALYZE_DEFAULTS & {
	definitionFileId?: string;
	definitionName?: string;
	settings?: string[];
	threads?: number;
	// CAM (opencamlib) tool params; omitted fields fall back to plugin defaults.
	toolDiameter?: number;
	toolLength?: number;
	stepover?: number;
	feed?: number;
	safeZ?: number;
};

function compact(o: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const k in o) if (o[k] !== undefined) out[k] = o[k];
	return out;
}

export type StepError = { stage: string; fileId: string; message: string };

export type ConvertedRecord = {
	sourceFileId: string;
	fileId: string;
	name: string;
	fileType: string;
	kind: string;
	collectionId?: string;
};

export type EstimateRecord = {
	sourceFileId: string;
	type: string;
	data: Estimate;
	artifactFileIds?: string[];
};

export type FlowCtx = {
	owner: string;
	processId: string;
	errors: StepError[];
	converted: ConvertedRecord[];
	estimates: EstimateRecord[];
};

export function step<T>(
	ctx: FlowCtx,
	stage: string,
	name: string,
	fileId: string,
	fn: () => T,
): T | undefined {
	const r = rt.attempt(name, fn);
	if (r.ok) return r.value;
	ctx.errors.push({ stage, fileId, message: r.error });
	return undefined;
}

export type StagedFile = {
	fileId: string;
	name: string;
	/** The whole file staged in the cache — what the estimators read. The
	 *  converter does not need it: it reads the file from its id. */
	ref: CacheRef;
	metadata: FileMetadata;
	type: string;
	mime: string;
	collectionId?: string;
};

export function stageFile(
	ctx: FlowCtx,
	fileId: string,
	collectionId?: string,
): StagedFile | undefined {
	const staged = step(ctx, "load", `materialize:${fileId}`, fileId, () =>
		files.materialize(fileId),
	);
	if (!staged) return undefined;
	const name = staged.metadata.name;
	const detected = step(ctx, "load", `detect:${fileId}`, fileId, () =>
		files.detectType({ ref: staged.ref, name }),
	);
	if (!detected) return undefined;
	return {
		fileId,
		name,
		ref: staged.ref,
		metadata: staged.metadata,
		type: detected.type,
		mime: detected.mime,
		collectionId,
	};
}

export function keep(
	ctx: FlowCtx,
	stage: string,
	node: string,
	staged: StagedFile,
	ref: CacheRef,
	name: string,
	fileType: string,
	kind: string,
): FileMetadata | undefined {
	const meta = step(ctx, stage, node, staged.fileId, () =>
		files.persist({
			ref,
			name,
			fileType,
			owner: ctx.owner,
			collectionId: staged.collectionId,
			processId: ctx.processId,
		}),
	);
	if (meta)
		ctx.converted.push({
			sourceFileId: staged.fileId,
			fileId: meta.id,
			name: meta.name,
			fileType: meta.fileType,
			kind,
			collectionId: staged.collectionId,
		});
	return meta;
}

export type UnpackResult = {
	collectionId: string;
	entries: { fileId: string; name: string }[];
};

export type StoredFile = {
	fileId: string;
	metadata: FileMetadata;
};

export function isArchive(metadata: FileMetadata): boolean {
	return (
		metadata.fileType === "application/zip" ||
		metadata.name.toLowerCase().endsWith(".zip")
	);
}

/** Read stored file metadata. Bytes and chunk refs stay outside the workflow VM,
 * so this is the cheap way to classify a file before staging it. */
export function loadFileMeta(
	ctx: FlowCtx,
	fileId: string,
): StoredFile | undefined {
	const metadata = step(ctx, "load", `file:${fileId}`, fileId, () =>
		files.get(fileId),
	);
	if (!metadata) return undefined;
	return { fileId, metadata };
}

function loadArchiveChunks(
	ctx: FlowCtx,
	fileId: string,
	metadata: FileMetadata,
): CompressedChunk[] | undefined {
	const fileChunks = step(ctx, "load", `chunks:${fileId}`, fileId, () =>
		files.getChunks(fileId),
	);
	if (!fileChunks) return undefined;
	if (!fileChunks.length && metadata.fileSize > 0) {
		ctx.errors.push({ stage: "load", fileId, message: "file has no chunks" });
		return undefined;
	}

	const chunks: CompressedChunk[] = [];
	for (const chunk of [...fileChunks].sort(
		(a, b) => a.chunkNumber - b.chunkNumber,
	)) {
		const stored = step(ctx, "load", `chunk:${chunk.hash}`, fileId, () =>
			store.getWithMeta(chunk.hash),
		);
		if (!stored) return undefined;
		chunks.push({
			ref: stored.dataRef,
			compression: stored.compression,
			originalSize: stored.originalSize,
		});
	}
	return chunks;
}

export function unpackArchive(
	ctx: FlowCtx,
	staged: StoredFile,
): UnpackResult | undefined {
	const { fileId, metadata } = staged;
	const name = metadata.name;
	const chunks = loadArchiveChunks(ctx, fileId, metadata);
	if (!chunks) return undefined;
	const collectionId = step(
		ctx,
		"archive",
		`collection:${fileId}`,
		fileId,
		() =>
			files.saveCollection({
				id: `${__execId ?? "wf"}:${fileId}`,
				name,
				description: `Files extracted from archive: ${name}`,
				owner: ctx.owner,
				createdAt: new Date().toISOString(),
			}),
	);
	if (!collectionId) return undefined;
	const unzipped = step(ctx, "archive", `unzip:${fileId}`, fileId, () =>
		compressors.unpack({ name, chunks }),
	);
	if (!unzipped) return undefined;
	const entries: UnpackResult["entries"] = [];
	for (const [entryIndex, entry] of unzipped.entries.entries()) {
		const entryId = `${ctx.processId}:${fileId}:${entryIndex}`;
		const createdAt = new Date().toISOString();
		const savedId = step(ctx, "archive", `save-file:${entryId}`, fileId, () =>
			files.save(
				{
					id: entryId,
					hash: entry.hash,
					status: "uploaded",
					name: entry.name,
					fileSize: entry.fileSize,
					fileType: entry.fileType,
					compression: "deflate",
					owner: ctx.owner,
					createdAt,
					chunksCount: entry.chunks.length,
					collectionId,
				},
				ctx.processId,
			),
		);
		if (!savedId) continue;

		let persisted = true;
		for (const [chunkIndex, chunk] of entry.chunks.entries()) {
			const hash = step(
				ctx,
				"archive",
				`store:${entryId}:${chunkIndex}`,
				fileId,
				() =>
					store.save(
						chunk.ref,
						chunk.originalSize,
						chunk.compression,
						ctx.owner,
					),
			);
			if (!hash) {
				persisted = false;
				break;
			}
			const savedChunk = step(
				ctx,
				"archive",
				`chunk:${entryId}:${chunkIndex}`,
				fileId,
				() =>
					files.saveChunk({
						fileId: savedId,
						hash,
						chunkNumber: chunkIndex,
						chunkSize: chunk.ref.sizeBytes ?? 0,
						createdAt,
					}),
			);
			if (!savedChunk) {
				persisted = false;
				break;
			}
		}
		if (!persisted) continue;
		ctx.converted.push({
			sourceFileId: fileId,
			fileId: savedId,
			name: entry.name,
			fileType: entry.fileType,
			kind: "archive_entry",
			collectionId,
		});
		entries.push({ fileId: savedId, name: entry.name });
	}
	return { collectionId, entries };
}

export function analyzeFile(
	ctx: FlowCtx,
	o: AnalyzeOptions,
	staged: StagedFile,
): void {
	const { fileId, name, ref } = staged;

	if (staged.type === "gcode") {
		// A raw g-code file has no native estimator (ptah slices/CAMs models,
		// it does not re-parse g-code); nothing to do.
		return;
	}

	if (!MODEL_TYPES.includes(staged.type)) return; // nothing to do

	if (o.convertPreview) {
		const converted = step(
			ctx,
			"convert-preview",
			`convert-preview:${fileId}`,
			fileId,
			() => models.convert({ fileId, format: "glb2" }),
		);
		// The converter names its output after the exporter ("result.glb"), which
		// says nothing about which model it belongs to. The request view pairs a
		// preview with its model by base name, so the name is set here, where the
		// source is known.
		const base = name.replace(/\.[^.]+$/, "");
		const outputs = converted?.files ?? [];
		for (const [i, out] of outputs.entries()) {
			const dot = out.name.lastIndexOf(".");
			const suffix = dot > 0 ? out.name.slice(dot) : ".glb";
			keep(
				ctx,
				"convert-preview",
				`preview:${fileId}:${i}`,
				staged,
				out.ref,
				outputs.length === 1 ? `${base}${suffix}` : `${base}-${out.name}`,
				"model/gltf-binary",
				"preview",
			);
		}
	}
	if (staged.type !== "stl") return; // only STL yields an estimate

	const gcodeName = `${name.replace(/\.[^.]+$/, "")}.gcode`;

	// from Valkey); tool params are small and shaped here. --------------------
	if (o.target === "cnc") {
		const out = step(ctx, "milling-extract", `milling:${fileId}`, fileId, () =>
			ptah.analyze(
				"opencamlib",
				compact({
					toolDiameter: o.toolDiameter,
					toolLength: o.toolLength,
					stepover: o.stepover,
					feed: o.feed,
					safeZ: o.safeZ,
				}),
				{ stlPath: ref.cacheKey },
				o.includeGcode ? ["gcodePath"] : [],
			),
		);
		if (!out) return;
		const gcodeRef = out.outputs?.gcodePath;
		const gcode =
			gcodeRef &&
			keep(
				ctx,
				"milling-extract",
				`gcode:milling:${fileId}`,
				staged,
				gcodeRef,
				gcodeName,
				"text/x-gcode",
				"gcode",
			);
		ctx.estimates.push({
			sourceFileId: fileId,
			type: "milling",
			data: { ...out.result, estimator: "ptah:opencamlib", sourceName: name },
			artifactFileIds: gcode ? [gcode.id] : [],
		});
		return;
	}

	// both ride by CacheRef. Without a definition there is no native estimator.
	if (o.definitionFileId) {
		const defId = o.definitionFileId;
		const def = step(
			ctx,
			"print-slice",
			`materialize-def:${defId}`,
			fileId,
			() => files.materialize(defId).ref,
		);
		const sliced =
			def &&
			step(ctx, "print-slice", `print-slice:${fileId}`, fileId, () =>
				ptah.analyze(
					"curaengine",
					compact({
						modelName: name,
						definitionName: o.definitionName ?? "definition.def.json",
						settings: o.settings,
						threads: o.threads,
					}),
					{ stlPath: ref.cacheKey, definitionPath: def.cacheKey },
					["gcodePath"],
				),
			);
		if (sliced) {
			const gcodeRef = sliced.outputs?.gcodePath;
			const gcode =
				o.includeGcode && gcodeRef
					? keep(
							ctx,
							"print-slice",
							`gcode:slice:${fileId}`,
							staged,
							gcodeRef,
							gcodeName,
							"text/x-gcode",
							"gcode",
						)
					: undefined;
			ctx.estimates.push({
				sourceFileId: fileId,
				type: "printing",
				data: {
					...sliced.result,
					estimator: "ptah:curaengine",
					sourceName: name,
				},
				artifactFileIds: gcode ? [gcode.id] : [],
			});
			return;
		}
	}
	ctx.errors.push({
		stage: "print-estimate",
		fileId,
		message: "no native print estimator without a definition file",
	});
}

/** Add one file to a request's display-name -> fileId map, keeping names unique. */
export function addRequestFile(
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

/** Write everything this run computed back onto the request in one node:
 * the GLB previews join `files` (the detail view matches a model's preview by
 * base name), the estimates and errors ride as typed `analysis` parameters. */
export function attachAnalysis(
	ctx: FlowCtx,
	requestId: string,
	previewFiles: Record<string, string>,
): RequestModel | undefined {
	return step(ctx, "request", `attach-analysis:${requestId}`, requestId, () =>
		requests.applyRequestUpdate(
			requestId,
			{
				files: previewFiles,
				parameters: [
					{
						key: "file_analysis_estimates",
						label: "File analysis estimates",
						type: "json",
						group: "analysis",
						value: ctx.estimates,
					},
					{
						key: "file_analysis_errors",
						label: "File analysis errors",
						type: "json",
						group: "analysis",
						value: ctx.errors,
					},
				],
			},
			ctx.owner,
			"file analysis",
		),
	);
}
