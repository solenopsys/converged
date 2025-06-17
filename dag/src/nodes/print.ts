import { type INode } from "../core/types";
import { Store } from "../core/store";

export class PrintNode implements INode {
	public scope!: string;

	constructor(public name: string) {}

	async execute(data: any): Promise<any> {
		console.log("INFO: ", data);
		return data;
	}
}
