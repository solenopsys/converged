import { type INode } from "../dag-api";

export class MergeNode implements INode {
	public scope!: string;
	private inputs: Map<string, any> = new Map();
	private expectedInputs: Set<string> = new Set();

	constructor(
		public name: string,
		expectedSources: string[] = [],
	) {
		expectedSources.forEach((source) => this.expectedInputs.add(source));
	}

	async execute(data: any, sourceNodeName?: string): Promise<any> {
		// Сохраняем данные от каждого источника
		if (sourceNodeName) {
			this.inputs.set(sourceNodeName, data);
		}

		// Проверяем, получили ли данные от всех ожидаемых источников
		if (this.expectedInputs.size > 0) {
			const receivedInputs = Array.from(this.inputs.keys());
			const hasAllInputs = Array.from(this.expectedInputs).every((expected) =>
				receivedInputs.includes(expected),
			);

			if (!hasAllInputs) {
				// Еще не все данные получены, ждем
				return null;
			}
		}

		// Объединяем все полученные данные
		const merged: any = {};
		for (const [source, value] of this.inputs.entries()) {
			merged[source] = value;
		}

		// Очищаем для следующего использования
		this.inputs.clear();

		return merged;
	}
}
