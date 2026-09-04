export type LlmCatalogParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

export type SurfaceLlmAction = {
	brief: string;
	category: string;
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: LlmCatalogParameters;
};

export type SurfaceLlmCatalog = {
	/** Optional hand-written module summary; action descriptions are the fallback. */
	description?: string;
	actions: Record<string, SurfaceLlmAction>;
	patterns?: Array<{
		prefix: string;
		meta: Omit<SurfaceLlmAction, "access" | "capability">;
	}>;
};
