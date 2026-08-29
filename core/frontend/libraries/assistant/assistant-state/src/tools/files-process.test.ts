import { describe, expect, test } from "bun:test";
import { createFilesProcessTool } from "./files-process";

describe("createFilesProcessTool", () => {
	test("runs the files-process workflow", async () => {
		const calls: Array<{
			scriptPath: string;
			params: Record<string, unknown>;
		}> = [];
		const tool = createFilesProcessTool({
			runWorkflow: async (scriptPath, params) => {
				calls.push({ scriptPath, params });
				return {
					executionId: "exec-1",
					ok: true,
					result: { files: [] },
				};
			},
		});

		const result = await tool.execute({ fileIds: ["file-1"] });

		expect(calls).toEqual([
			{
				scriptPath: "workflows/wf-files-process.js",
				params: { fileIds: ["file-1"] },
			},
		]);
		expect(result).toEqual({
			ok: true,
			executionId: "exec-1",
			result: { files: [] },
		});
	});
});
