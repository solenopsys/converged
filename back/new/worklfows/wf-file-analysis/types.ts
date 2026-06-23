import type { CacheRef } from "g-store/rt";

export type Target = "cnc" | "print" | "generic";

export type FileAnalysisInput = {
	fileIds: string[];
	owner?: string;
	processId?: string;
	options?: Partial<AnalysisOptions>;
};

export type AnalysisOptions = {
	target: Target;
	includeGcode: boolean;
	convertPreview: boolean;
	maxArchiveDepth: number;
	definitionFileId?: string;
	definitionName?: string;
	settings?: string[];
	density?: number;
	filamentDiameter?: number;
	infillPercent?: number;
	volumetricRateMm3PerSec?: number;
	threads?: number;
};

export type Options = AnalysisOptions & { owner: string; processId: string };

export type FileKind = "archive" | "model" | "gcode" | "other";
export type FileRole = "input" | "extracted";

/** A file staged into Valkey: we hold a reference, never the bytes. */
export type StagedFile = {
	fileId: string;
	name: string;
	ref: CacheRef;
	size: number;
	mime: string;
	type: string;
	kind: FileKind;
	role: FileRole;
	depth: number;
	collectionId?: string;
};

export type WorkItem = {
	fileId: string;
	role: FileRole;
	depth: number;
	collectionId?: string;
};

export type FileResult = {
	fileId: string;
	name: string;
	fileType: string;
	size: number;
	detectedType: string;
	role: FileRole;
	collectionId?: string;
};

export type Artifact = {
	sourceFileId: string;
	fileId: string;
	name: string;
	fileType: string;
	kind: "preview" | "gcode" | "archive_entry";
	collectionId?: string;
};

export type Estimate = {
	sourceFileId: string;
	type: "milling" | "printing" | "gcode";
	data: Record<string, unknown>;
	artifactFileIds?: string[];
};

export type AnalysisError = {
	stage: string;
	fileId?: string;
	name?: string;
	message: string;
};

export type FileAnalysisResult = {
	inputs: FileResult[];
	extracted: FileResult[];
	converted: Artifact[];
	estimates: Estimate[];
	errors: AnalysisError[];
	collections: Record<string, string>;
};
