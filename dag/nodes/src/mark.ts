import type { INode } from "dag-api";
import { marked } from "marked";
import type { ContextAccessor } from "dag-api";

export class MarkNode implements INode {
	public scope!: string;

	constructor(
		public name: string,
		private templatePath: string,
		private convertToHtml = false,
	) {}

	async execute(data: any, accessor: ContextAccessor): Promise<any> {
		const markdownContent = await accessor.getFrom(data, this.templatePath);

		if (!markdownContent) {
			throw new Error(`No data found at JSON path: ${this.templatePath}`);
		}

		try {
			let htmlContent = marked(markdownContent, {
				breaks: true,
			});

			if (this.convertToHtml) {
				htmlContent = `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body>${htmlContent}</body>
                </html>`;
			}

			return htmlContent;
		} catch (error: any) {
			throw new Error(`Error converting markdown to HTML: ${error.message}`);
		}
	}
}
