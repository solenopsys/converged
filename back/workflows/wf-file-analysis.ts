import { Workflow } from "@rt/engines/dag";
import {
	type FileAnalysisInput,
	FileAnalysisProcessFilesNode,
} from "./nodes/file-analysis";

export class FileAnalysisWorkflow extends Workflow {
	private processFiles = new FileAnalysisProcessFilesNode("process-files");

	async execute(params: FileAnalysisInput): Promise<void> {
		const result = await this.invoke("process-files", () =>
			this.processFiles.execute({
				...params,
				processId: params.processId ?? this.id,
			}),
		);
		this.setVar("file-analysis:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [
	{ name: "file-analysis", ctor: FileAnalysisWorkflow },
];

export default FileAnalysisWorkflow;
