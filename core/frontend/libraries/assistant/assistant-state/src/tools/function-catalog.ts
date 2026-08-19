import type { ExecutableTool } from "../types";



export interface FunctionBrief {
	id: string;
	brief: string;
	category?: string;
}

export interface FunctionCategory {
	id: string;
	count: number;
}

export interface FunctionCatalogRegistry {
	get(
		id: string,
	):
		| { id: string; brief?: string; description: string; category?: string }
		| undefined;
}

export interface FunctionCatalogContext {
	getHot(): FunctionBrief[];
	listCategories(): FunctionCategory[];
	listByCategory(category: string): FunctionBrief[];
	search(query: string, limit?: number): FunctionBrief[];
}

export type FunctionCatalogOptions = {
	registry: FunctionCatalogRegistry;
	context: FunctionCatalogContext;

	invoke: (id: string, args: Record<string, unknown>) => unknown | Promise<unknown>;

	load?: (id: string) => Promise<void>;
};

export function createFunctionCatalogTools({
	registry,
	context,
	invoke,
	load,
}: FunctionCatalogOptions): ExecutableTool[] {

	const preload = (candidates: FunctionBrief[]) => {
		const top = candidates[0];
		if (top && load) void load(top.id).catch(() => {});
		return candidates;
	};

	return [
		{
			name: "listFunctions",
			description:
				"Discover callable functions. " +
				"Without arguments: recently used functions plus available categories. " +
				"With query: word search across ids, briefs and descriptions. " +
				"With category: everything in one category. " +
				"Call this first whenever you are not certain which function to use — " +
				"the full catalog is never in your context.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search words matched against function ids and descriptions",
					},
					category: {
						type: "string",
						description: "Category id, as returned by a bare listFunctions call",
					},
				},
			},
			execute: (args: unknown) => {
				const { query, category } = (args ?? {}) as {
					query?: string;
					category?: string;
				};
				if (query) return preload(context.search(query));
				if (category) return preload(context.listByCategory(category));
				return { hot: context.getHot(), categories: context.listCategories() };
			},
		},

		{
			name: "describeFunction",
			description:
				"Get the full description of one function before calling it. " +
				"Use when the brief is not enough to build the arguments.",
			parameters: {
				type: "object",
				properties: {
					id: { type: "string", description: "Function id" },
				},
				required: ["id"],
			},
			execute: (args: unknown) => {
				const { id } = (args ?? {}) as { id: string };
				const fn = registry.get(id);
				if (!fn) {
					return {
						error: `Unknown function: "${id}". Use listFunctions to discover valid ids.`,
					};
				}
				return {
					id: fn.id,
					brief: fn.brief,
					description: fn.description,
					category: fn.category,
				};
			},
		},

		{
			name: "invokeFunction",
			description:
				"Call a function by id and get its result. " +
				"Functions are single, fast calls that return a fact — use them for known " +
				"intents on known data. For long multi-step scenarios that must survive the " +
				"tab being closed, start a workflow instead and tell the user it is running.",
			parameters: {
				type: "object",
				properties: {
					id: { type: "string", description: "Function id to call" },
					args: {
						type: "object",
						description: "Arguments, as described by describeFunction",
					},
				},
				required: ["id"],
			},
			execute: async (params: unknown) => {
				const { id, args = {} } = (params ?? {}) as {
					id: string;
					args?: Record<string, unknown>;
				};
				try {
					const result = await invoke(id, args);
					return result === undefined ? { ok: true, id } : { ok: true, id, result };
				} catch (error) {
					return {
						ok: false,
						id,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			},
		},
	];
}
