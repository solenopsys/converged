import { type INode, type ProcessNode } from "../core/types";
import { RandomGenerator, CharsetPresets } from "../libs/random";

export class RandomStringNode implements INode {
	public scope!: string;
	private randomGenerator: RandomGenerator;

	constructor(
		public name: string,
		length: number = 10,
		charset: string = CharsetPresets.ALPHANUMERIC,
	) {
		this.randomGenerator = new RandomGenerator(length, charset);
	}

	async execute(data: any): Promise<any> {
		return { value: this.randomGenerator.generate() };
	}
}

export { CharsetPresets };
