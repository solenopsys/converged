import { type INode,RandomGenerator, CharsetPresets  } from "dag-api";

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
