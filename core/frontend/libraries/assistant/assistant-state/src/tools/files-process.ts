import type { ExecutableTool } from "../types";
import { parseToolArgs } from "./args";

export type WorkflowRunResult = {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: unknown;
};

export type WorkflowRunner = {
	runWorkflow(
		scriptPath: string,
		params: Record<string, unknown>,
	): Promise<WorkflowRunResult>;
};

export type FilesProcessHooks = {
	onResult?: (result: unknown) => Promise<unknown>;
};

type FilesProcessArgs = {
	fileIds?: string[];
};

export const createFilesProcessTool = (
	workflow: WorkflowRunner,
	hooks: FilesProcessHooks = {},
): ExecutableTool => ({
	name: "startFilesProcess",
	description:
		"Process uploaded files: unpack ZIP archives, identify model files, and create a request when models are present",
	parameters: {
		type: "object",
		properties: {
			fileIds: {
				type: "array",
				description: "List of ms-files file IDs to analyze",
				items: {
					type: "string",
					description: "ms-files file ID",
				},
			},
			target: {
				type: "string",
				description: "Analysis target",
				enum: ["cnc", "print", "generic"],
			},
			convertPreview: {
				type: "boolean",
				description:
					"Whether the workflow should try to create preview model artifacts",
			},
			includeGcode: {
				type: "boolean",
				description: "Whether extractors may return generated G-code artifacts",
			},
			definitionFileId: {
				type: "string",
				description:
					"Optional Cura printer definition JSON file ID for exact STL print slicing estimates",
			},
			density: {
				type: "number",
				description: "Filament density g/cm³, default 1.24 for PLA",
			},
			filamentDiameter: {
				type: "number",
				description: "Filament diameter in mm, default 1.75",
			},
			infillPercent: {
				type: "number",
				description:
					"Infill percent for rough STL geometry print estimate when no Cura definition is provided",
			},
			maxArchiveDepth: {
				type: "number",
				description: "Maximum archive recursion depth",
			},
		},
		required: ["fileIds"],
	},
	execute: async (rawArgs: FilesProcessArgs | string) => {
		const args = parseToolArgs<FilesProcessArgs>(rawArgs);
		const fileIds = Array.isArray(args.fileIds)
			? args.fileIds.filter(
					(fileId): fileId is string =>
						typeof fileId === "string" && fileId.length > 0,
				)
			: [];

		if (fileIds.length === 0) {
			return { ok: false, error: "fileIds must contain at least one file ID" };
		}

		const execution = await workflow.runWorkflow(
			"workflows/wf-files-process.js",
			{ fileIds },
		);

		if (!execution.ok) {
			return {
				ok: false,
				executionId: execution.executionId,
				error: execution.error ?? "files-process workflow failed",
			};
		}

		let result = execution.result ?? null;

		if (result && hooks.onResult) {
			result = await hooks.onResult(result);
		}

		return { ok: true, executionId: execution.executionId, result };
	},
});
