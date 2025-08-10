import { type INode } from "dag-api";

export default class PrintNode implements INode {
	public scope!: string;

	constructor(public name: string) {}

	async execute(data: any): Promise<any> {
		console.log("INFO: ", data);
		return data;
	}
}
