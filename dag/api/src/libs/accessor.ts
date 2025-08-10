import { evaluateJsonPathString } from "./path";
import { type ContextAccessor } from "../core/types";
import { Store } from "../persistent/kvs/store";

export class Accessor implements ContextAccessor {
	constructor(
		private store: Store,
		private workflowId: string,
	) {}

	private getFromObject(data: any, path: string) {
		return evaluateJsonPathString(data, path);
	}

	public async getFrom(data: any, path: string) {
		console.log("GET FROM", path);
		console.log("DATA", data);

		// Проверяем, начинается ли путь с $.context
		const contextPattern = /^\$\.context\.([^.\[]+)(.*)$/;
		const match = path.match(contextPattern);

		if (!match) {
			// Если не начинается с $.context, используем обычный JSONPath
			return evaluateJsonPathString(data, path);
		}

		const [, objectName, remainingPath] = match;

		// Получаем данные из контекста
		const contextData = await this.store.get(this.workflowId, objectName);

		if (!contextData) {
			throw new Error(`Context object '${objectName}' not found`);
		}

		// Если есть оставшийся путь, применяем его к данным контекста
		if (remainingPath) {
			// Формируем новый JSONPath для данных контекста
			const newPath = `$${remainingPath}`;
			return evaluateJsonPathString(contextData, newPath);
		}

		// Если нет оставшегося пути, возвращаем весь объект контекста
		return contextData;
	}
}
