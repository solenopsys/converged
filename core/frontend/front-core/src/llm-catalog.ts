export type LlmCatalogParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

export type MicrofrontendLlmAction = {
	brief: string;
	category: string;
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: LlmCatalogParameters;
};

export type MicrofrontendLlmCatalog = {
	/** Optional hand-written module summary; action descriptions are the fallback. */
	description?: string;
	actions: Record<string, MicrofrontendLlmAction>;
	patterns?: Array<{
		prefix: string;
		meta: Omit<MicrofrontendLlmAction, "access" | "capability">;
	}>;
};
