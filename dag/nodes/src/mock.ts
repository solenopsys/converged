import { type INode } from "dag-api";

export class MockNode implements INode {
	public scope!: string;

	constructor(
		public name: string,
		public data: any,
	) {}

	async execute(data: any): Promise<any> {
		return this.data;
	}
}
