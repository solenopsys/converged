import { type INode } from "dag-api";

export class StartNode implements INode {
	public scope!: string;

	constructor(
		public name: string,
		public consts: Record<string, string>,
	) {}

	async execute(data: any): Promise<any> {
		return { ...this.consts, ...data };
	}
}
