import { type INode } from "dag-api";

export default class StartNode implements INode {
	public scope!: string;

	constructor(
		public name: string,
		public consts: any,
	) {}

	async execute(data: any): Promise<any> {
		return this.consts;
	}
}
