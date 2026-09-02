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
		"Process uploaded files: unpack ZIP archives and report what was uploaded, including which files are production models. Does not create a request — decide that separately",
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
