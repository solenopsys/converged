import type { INode } from "dag-api";
import { marked } from "marked"; 

export  default class MarkNode implements INode {
	public scope!: string;

	constructor(
		public name: string, 
		private convertToHtml = false,
	) {}

	async execute(data:{markdown: string} ): Promise<any> { 

		console.log("markdown",data.markdown);
		try {
			let htmlContent = marked(data.markdown, {
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
