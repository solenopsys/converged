import { Workflow } from "@rt/engines/dag";
import {
	SalesImportBuildEmptyResultNode,
	SalesImportBuildResultNode,
	SalesImportExtractLeadsNode,
	type SalesImportInput,
	SalesImportLoadTextSourcesNode,
	SalesImportNormalizeLeadsNode,
	SalesImportPersistNode,
} from "./nodes/sales-import";

export class SalesImportWorkflow extends Workflow {
	private loadTextSources = new SalesImportLoadTextSourcesNode(
		"load-text-sources",
	);
	private buildEmptyResult = new SalesImportBuildEmptyResultNode(
		"build-empty-result",
	);
	private extractLeads = new SalesImportExtractLeadsNode("extract-leads");
	private normalizeLeads = new SalesImportNormalizeLeadsNode("normalize-leads");
	private buildResult = new SalesImportBuildResultNode("build-result");
	private persistImport = new SalesImportPersistNode("persist-import");

	async execute(params: SalesImportInput = {}): Promise<void> {
		const { sourceText } = await this.invoke("load-text-sources", () =>
			this.loadTextSources.execute(params),
		);

		if (!sourceText) {
			const empty = await this.invoke("build-empty-result", () =>
				this.buildEmptyResult.execute({}),
			);
			this.setVar("sales-import:last-result", empty);
			await this.invoke("final-result", async () => empty);
			return;
		}

		const { rawLeads } = await this.invoke("extract-leads", () =>
			this.extractLeads.execute({ sourceText, params }),
		);
		const { normalized } = await this.invoke("normalize-leads", () =>
			this.normalizeLeads.execute({ rawLeads, params }),
		);
		let result = await this.invoke("build-result", () =>
			this.buildResult.execute({ normalized, dryRun: params.dryRun }),
		);

		if (!params.dryRun) {
			result = await this.invoke("persist-import", () =>
				this.persistImport.execute({ params, normalized, result }),
			);
		}

		this.setVar("sales-import:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [{ name: "sales-import", ctor: SalesImportWorkflow }];
