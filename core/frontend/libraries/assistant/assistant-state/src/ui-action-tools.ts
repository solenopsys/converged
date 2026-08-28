import {
	createFunctionCatalogTools,
	type FunctionBrief,
	type FunctionCategory,
} from "./tools/function-catalog";
import type { ExecutableTool } from "./types";



export type ActionBrief = FunctionBrief;
export type CategorySummary = FunctionCategory;

export interface UIActionRegistryLike {
	get(
		id: string,
	):
		| {
				id: string;
				brief?: string;
				description: string;
				category?: string;
				parameters?: FunctionBrief["parameters"];
		  }
		| undefined;
	run(id: string, params: any): unknown;
}

export interface ActionContextManagerLike {
	recordInvoke(id: string): void;
	getHot(): ActionBrief[];
	listCategories(): CategorySummary[];
	listByCategory(category: string): ActionBrief[];
	search(query: string, limit?: number): ActionBrief[];
}

export type MFLoader = (actionId: string) => Promise<void>;

const LEGACY_NAMES: Record<string, string> = {
	listFunctions: "listUIActions",
	describeFunction: "describeUIAction",
	invokeFunction: "invokeUIAction",
};

export function createUIActionTools(
	registry: UIActionRegistryLike,
	ctx: ActionContextManagerLike,
	loadMF?: MFLoader,
): ExecutableTool[] {
	const tools = createFunctionCatalogTools({
		registry,
		context: ctx,
		load: loadMF,
		invoke: async (id, args) => {
			if (!registry.get(id) && loadMF) await loadMF(id);
			if (!registry.get(id)) {
				throw new Error(
					`Action not found: "${id}". Use listUIActions to find the correct action id.`,
				);
			}
			ctx.recordInvoke(id);
			return registry.run(id, args);
		},
	});

	return tools.map((tool) => ({ ...tool, name: LEGACY_NAMES[tool.name] ?? tool.name }));
}
