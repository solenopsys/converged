// Stages — one microservice step each, with its own error boundary. Heavy work
// happens inside the services; here we only sequence references (CacheRef) and
// fold the small results into the report.

import type { CacheRef } from "g-store/rt";
import { files, milling, models, print } from "./clients";
import type { Run } from "./run";
import type { StagedFile } from "./types";

export function convertPreview(run: Run, file: StagedFile): void {
	run.guard("convert-preview", file, () => {
		const converted = rt.node(`convert-preview:${file.fileId}`, () =>
			models.convert({ sourceRef: file.ref, sourceName: file.name, format: "glb2" }),
		);
		converted.files.forEach((out, i) => {
			const meta = persist(run, `preview:${file.fileId}:${i}`, out.ref, out.name, "model/gltf-binary", file.collectionId);
			run.addArtifact({ ...artifactOf(file, meta), kind: "preview" });
		});
	});
}

export function estimateMilling(run: Run, file: StagedFile): void {
	run.guard("milling-extract", file, () => {
		const out = rt.node(`milling:${file.fileId}`, () =>
			milling.extract({ modelRef: file.ref, modelName: file.name, includeGcode: run.options.includeGcode }),
		);
		const gcodeIds = saveGcode(run, "milling", file, out.gcodeRef);
		run.addEstimate({
			sourceFileId: file.fileId,
			type: "milling",
			data: { ...out.estimate, estimator: "millingextractor", sourceName: file.name },
			artifactFileIds: gcodeIds,
		});
	});
}

export function estimatePrinting(run: Run, file: StagedFile): void {
	if (run.options.definitionFileId && slice(run, file)) return;
	geometry(run, file);
}

export function estimateGcode(run: Run, file: StagedFile): void {
	run.guard("gcode-extract", file, () => {
		const estimate = rt.node(`gcode-estimate:${file.fileId}`, () =>
			print.extractFromGcode({
				gcodeRef: file.ref,
				density: run.options.density,
				filamentDiameter: run.options.filamentDiameter,
			}),
		);
		run.addEstimate({ sourceFileId: file.fileId, type: "gcode", data: estimate as Record<string, unknown> });
	});
}

export function expandArchive(run: Run, file: StagedFile): void {
	if (file.depth >= run.options.maxArchiveDepth) {
		run.fail("archive", file, new Error(`recursion depth exceeded: ${run.options.maxArchiveDepth}`));
		return;
	}
	run.guard("archive", file, () => {
		const collectionId = rt.node(`collection:${file.fileId}`, () =>
			files.saveCollection({
				id: `${__execId ?? "wf"}:${file.fileId}`,
				name: file.name,
				description: `Files extracted from archive: ${file.name}`,
				owner: run.options.owner,
				createdAt: new Date().toISOString(),
			}),
		);
		run.addCollection(file.fileId, collectionId);

		const unzipped = rt.node(`unzip:${file.fileId}`, () =>
			files.unzip({ ref: file.ref, collectionId, owner: run.options.owner, processId: run.options.processId }),
		);
		for (const entry of unzipped.entries) {
			run.addArtifact({ sourceFileId: file.fileId, fileId: entry.fileId, name: entry.name, fileType: "", kind: "archive_entry", collectionId });
		}
		// Recursion stays in the flow: feed the entries back through the queue.
		run.enqueue(unzipped.entries.map((e) => e.fileId), "extracted", file.depth + 1, collectionId);
	});
}

// ---- printing variants -----------------------------------------------------

/** Cura slice estimate; returns false (so the caller falls back) if it failed. */
function slice(run: Run, file: StagedFile): boolean {
	const result = run.guard("print-slice", file, () => {
		const sliced = rt.node(`print-slice:${file.fileId}`, () =>
			print.extractFromSlice({
				modelRef: file.ref,
				modelName: file.name,
				definitionRef: definitionRef(run),
				definitionName: run.options.definitionName,
				settings: run.options.settings,
				density: run.options.density,
				filamentDiameter: run.options.filamentDiameter,
				threads: run.options.threads,
			}),
		);
		const gcodeIds = run.options.includeGcode ? saveGcode(run, "slice", file, sliced.gcodeRef) : undefined;
		run.addEstimate({
			sourceFileId: file.fileId,
			type: "printing",
			data: { ...sliced.estimate, estimator: "cura-slice", sourceName: file.name },
			artifactFileIds: gcodeIds,
		});
		return true;
	});
	return result === true;
}

/** Rough geometry-based estimate (no slicer definition supplied). */
function geometry(run: Run, file: StagedFile): void {
	run.guard("print-geometry", file, () => {
		const estimate = rt.node(`print-geometry:${file.fileId}`, () =>
			print.estimateGeometry({
				modelRef: file.ref,
				modelName: file.name,
				density: run.options.density,
				filamentDiameter: run.options.filamentDiameter,
				infillPercent: run.options.infillPercent,
				volumetricRateMm3PerSec: run.options.volumetricRateMm3PerSec,
			}),
		);
		run.addEstimate({ sourceFileId: file.fileId, type: "printing", data: estimate as Record<string, unknown> });
	});
}

// ---- helpers ---------------------------------------------------------------

let cachedDefinitionRef: CacheRef | undefined;

function definitionRef(run: Run): CacheRef {
	const fileId = run.options.definitionFileId as string;
	cachedDefinitionRef ??= rt.node(`materialize-def:${fileId}`, () => files.materialize(fileId).ref);
	return cachedDefinitionRef;
}

function saveGcode(run: Run, stage: string, file: StagedFile, gcodeRef?: CacheRef): string[] {
	if (!gcodeRef) return [];
	const name = `${file.name.replace(/\.[^.]+$/, "")}.gcode`;
	const meta = persist(run, `gcode:${stage}:${file.fileId}`, gcodeRef, name, "text/x-gcode", file.collectionId);
	run.addArtifact({ ...artifactOf(file, meta), kind: "gcode" });
	return [meta.id];
}

type PersistedMeta = { id: string; name: string; fileType: string };

function persist(run: Run, node: string, ref: CacheRef, name: string, fileType: string, collectionId?: string): PersistedMeta {
	return rt.node(node, () =>
		files.persist({ ref, name, fileType, owner: run.options.owner, collectionId, processId: run.options.processId }),
	);
}

function artifactOf(file: StagedFile, meta: PersistedMeta) {
	return {
		sourceFileId: file.fileId,
		fileId: meta.id,
		name: meta.name,
		fileType: meta.fileType,
		collectionId: file.collectionId,
	};
}
