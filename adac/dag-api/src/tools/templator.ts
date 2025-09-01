import { JSONPath } from "jsonpath-plus";

function processTemplate(
	template: string,
	data: Record<string, string>,
): string {
	let processedTemplate = template;

	for (const [key, path] of Object.entries(data)) {
		const regex = new RegExp(`\\{${key}\\}`, "g");
		processedTemplate = processedTemplate.replace(regex, path);
	}

	return processedTemplate;
}

/**
 * Извлекает значение из объекта по JSON Path
 */
function extractValueByPath(data: any, path: string): any {
	try {
		const result = JSONPath({ path, json: data });
		return result.length > 0 ? result[0] : null;
	} catch (error) {
		console.error(`Invalid JSON Path: ${path}`, error);
		return null;
	}
}

function extractParams(sql: string): string[] {
	// Паттерн для поиска параметров в формате :path или :${path}
	const paramPattern = /:(\$\{[^}]+\}|[^\s,;)]+)/g;
	const params: string[] = [];
	let match;

	// Извлекаем все совпадения
	while ((match = paramPattern.exec(sql)) !== null) {
		const captured = match[1];
		let jsonPath: string;

		// Проверяем формат параметра
		if (captured.startsWith("${") && captured.endsWith("}")) {
			// Формат :${$.path.to.value}
			jsonPath = captured.slice(2, -1);
		} else if (captured.startsWith("$.")) {
			// Формат :$.path.to.value
			jsonPath = captured;
		} else {
			// Простой формат :name (для обратной совместимости)
			jsonPath = `$.${captured}`;
		}

		params.push(jsonPath);
	}

	return params;
}
export { processTemplate, extractParams };
