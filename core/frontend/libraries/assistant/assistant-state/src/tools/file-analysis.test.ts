import { describe, expect, test } from "bun:test";
import { createFileAnalysisTool } from "./file-analysis";

describe("createFileAnalysisTool", () => {
	test("runs the Centimanus workflow contract with normalized options", async () => {
		const calls: Array<{
			scriptPath: string;
			params: Record<string, unknown>;
		}> = [];
		const tool = createFileAnalysisTool({
			runWorkflow: async (scriptPath, params) => {
				calls.push({ scriptPath, params });
				return {
					executionId: "exec-1",
					ok: true,
					result: { inputs: [] },
				};
			},
		});

		const result = await tool.execute({
			fileIds: ["file-1"],
			target: "print",
			includeGcode: true,
		});

		expect(calls).toEqual([
			{
				scriptPath: "workflows/wf-file-analysis.js",
				params: {
					fileIds: ["file-1"],
					options: {
						target: "print",
						convertPreview: false,
						includeGcode: true,
						maxArchiveDepth: 2,
					},
				},
			},
		]);
		expect(result).toEqual({
			ok: true,
			executionId: "exec-1",
			result: { inputs: [] },
		});
	});
});
