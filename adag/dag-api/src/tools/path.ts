import { JSONPath } from "jsonpath-plus";

function evaluateJsonPath(data: any, jsonPath: string): any {
	console.log("EVALUATE ", data, jsonPath);
	if (!jsonPath) return "";

	try {
		const result = JSONPath({ path: jsonPath, json: data });
		const value = Array.isArray(result) ? result[0] : result;
		return value !== undefined ? value : null;
	} catch (error) {
		return null;
	}
}

function evaluateJsonPathString(data: any, jsonPath: string): string {
	return evaluateJsonPath(data, jsonPath).toString() ?? "";
}

export { evaluateJsonPath, evaluateJsonPathString };
