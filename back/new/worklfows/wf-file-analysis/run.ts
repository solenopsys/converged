// Run — the machinery of the flow, kept out of sight so the pipeline stays
// readable. It owns the work queue, stages files into Valkey (by reference),
// records results, and captures per-step errors. Stages and the dispatcher talk
// to it; they never touch the queue or the result shape directly.

import { files } from "./clients";
import type {
	AnalysisError,
	Artifact,
	Estimate,
	FileAnalysisInput,
	FileAnalysisResult,
	FileKind,
	Options,
	StagedFile,
	WorkItem,
} from "./types";

const MODEL_TYPES = new Set(["step", "stl", "obj", "ply", "3mf"]);

const DEFAULTS = {
	target: "cnc",
	includeGcode: false,
	convertPreview: true,
	maxArchiveDepth: 2,
} as const;

export class Run {
	readonly options: Options;

	private readonly queue: WorkItem[] = [];
	private readonly result: FileAnalysisResult = {
		inputs: [],
		extracted: [],
		converted: [],
		estimates: [],
		errors: [],
		collections: {},
	};

	constructor(input: FileAnalysisInput) {
		this.options = {
			...DEFAULTS,
			...(input.options ?? {}),
			owner: input.owner ?? "workflow:file-analysis",
			processId: input.processId ?? __execId ?? "file-analysis",
		};
		this.enqueue(input.fileIds ?? [], "input", 0);
	}

	/** Add files to analyse (initial inputs, or entries pulled from an archive). */
	enqueue(fileIds: string[], role: WorkItem["role"], depth: number, collectionId?: string): void {
		for (const fileId of fileIds) {
			if (typeof fileId === "string" && fileId.length > 0) {
				this.queue.push({ fileId, role, depth, collectionId });
			}
		}
	}

	/** Drain the queue, staging each file and handing it to `analyse`. */
	forEachFile(analyse: (run: Run, file: StagedFile) => void): void {
		while (this.queue.length > 0) {
			const item = this.queue.shift() as WorkItem;
			const file = this.stage(item);
			if (file) analyse(this, file);
		}
	}

	report(): FileAnalysisResult {
		return this.result;
	}

	// ---- recording (encapsulates the result shape) -------------------------

	addArtifact(artifact: Artifact): void {
		this.result.converted.push(artifact);
	}

	addEstimate(estimate: Estimate): void {
		this.result.estimates.push(estimate);
	}

	addCollection(sourceFileId: string, collectionId: string): void {
		this.result.collections[sourceFileId] = collectionId;
	}

	/** Run a step, recording any failure as a non-fatal error on the report. */
	guard<T>(stage: string, file: { fileId?: string; name?: string }, step: () => T): T | undefined {
		try {
			return step();
		} catch (error) {
			this.fail(stage, file, error);
			return undefined;
		}
	}

	fail(stage: string, file: { fileId?: string; name?: string }, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		this.result.errors.push({ stage, fileId: file.fileId, name: file.name, message });
	}

	// ---- staging (materialize + detect, all by reference) ------------------

	private stage(item: WorkItem): StagedFile | undefined {
		return this.guard("load", { fileId: item.fileId }, () => {
			const staged = rt.node(`materialize:${item.fileId}`, () => files.materialize(item.fileId));
			const detected = rt.node(`detect:${item.fileId}`, () =>
				files.detectType({ ref: staged.ref, name: staged.metadata.name }),
			);

			const file: StagedFile = {
				fileId: staged.metadata.id,
				name: staged.metadata.name,
				ref: staged.ref,
				size: staged.metadata.fileSize,
				mime: detected.mime,
				type: detected.type,
				kind: classify(detected.type),
				role: item.role,
				depth: item.depth,
				collectionId: item.collectionId,
			};
			this.record(file);
			return file;
		});
	}

	private record(file: StagedFile): void {
		const bucket = file.role === "input" ? this.result.inputs : this.result.extracted;
		bucket.push({
			fileId: file.fileId,
			name: file.name,
			fileType: file.mime,
			size: file.size,
			detectedType: file.type,
			role: file.role,
			collectionId: file.collectionId,
		});
	}
}

function classify(type: string): FileKind {
	if (type === "zip") return "archive";
	if (type === "gcode") return "gcode";
	if (MODEL_TYPES.has(type)) return "model";
	return "other";
}
