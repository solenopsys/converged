// dag-file-steps — the shared flow pieces of the file workflows:
// wf-file-unpack (decompress an archive), wf-file-analyze (analyse one file),
// wf-file-analysis (the cascade the chat triggers). Flow only and synchronous:
// every side effect is exactly one service call inside one rt.attempt node,
// heavy bytes always travel by CacheRef. Service methods: see the workflows'
// contract.md.

import { contractClient } from "dag-core";
import type { FileCollection, FileMetadata, UUID } from "g-files/rt";
import type { CacheRef } from "g-store/rt";

export type { CacheRef };


export const files = contractClient<{
	materialize(fileId: UUID): { ref: CacheRef; metadata: FileMetadata };
	detectType(input: { ref: CacheRef; name: string }): { type: string; mime: string };
	unzip(input: { ref: CacheRef; collectionId: UUID; owner: string; processId?: string }): {
		entries: { fileId: UUID; name: string }[];
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
	materialize: ["fileId"],
	detectType: ["input"],
	unzip: ["input"],
	persist: ["input"],
	saveCollection: ["collection"],
});

export const models = contractClient<{
	convert(input: { sourceRef: CacheRef; sourceName: string; format?: string }): {
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


export function unpackArchive(
	ctx: FlowCtx,
	staged: StagedFile,
): UnpackResult | undefined {
	const { fileId, name, ref } = staged;
	const collectionId = step(ctx, "archive", `collection:${fileId}`, fileId, () =>
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
		files.unzip({ ref, collectionId, owner: ctx.owner, processId: ctx.processId }),
	);
	if (!unzipped) return undefined;
	for (const e of unzipped.entries) {
		ctx.converted.push({
			sourceFileId: fileId,
			fileId: e.fileId,
			name: e.name,
			fileType: "",
			kind: "archive_entry",
			collectionId,
		});
	}
	return { collectionId, entries: unzipped.entries };
}


export function analyzeFile(ctx: FlowCtx, o: AnalyzeOptions, staged: StagedFile): void {
	const { fileId, name, ref } = staged;

	if (staged.type === "gcode") {
		// A raw g-code file has no native estimator (ptah slices/CAMs models,
		// it does not re-parse g-code); nothing to do.
		return;
	}

	if (!MODEL_TYPES.includes(staged.type)) return; // nothing to do

	if (o.convertPreview) {
		const converted = step(ctx, "convert-preview", `convert-preview:${fileId}`, fileId, () =>
			models.convert({ sourceRef: ref, sourceName: name, format: "glb2" }),
		);
		converted?.files.forEach((out, i) =>
			keep(ctx, "convert-preview", `preview:${fileId}:${i}`, staged, out.ref, out.name, "model/gltf-binary", "preview"),
		);
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
			keep(ctx, "milling-extract", `gcode:milling:${fileId}`, staged, gcodeRef, gcodeName, "text/x-gcode", "gcode");
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
		const def = step(ctx, "print-slice", `materialize-def:${defId}`, fileId, () =>
			files.materialize(defId).ref,
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
					? keep(ctx, "print-slice", `gcode:slice:${fileId}`, staged, gcodeRef, gcodeName, "text/x-gcode", "gcode")
					: undefined;
			ctx.estimates.push({
				sourceFileId: fileId,
				type: "printing",
				data: { ...sliced.result, estimator: "ptah:curaengine", sourceName: name },
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
