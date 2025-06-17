import { type INode } from "../core/types";
import { Readability } from "@mozilla/readability";

export class HtmlCleanNode implements INode {
	public scope!: string;

	constructor(public name: string) {}

	async execute(data: any): Promise<any> {
		var article = new Readability(data).parse();

		return article;
	}
}
