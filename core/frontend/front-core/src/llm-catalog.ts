export type LlmCatalogParameters = {
	type: "object";
	properties: Record<string, unknown>;
	required?: string[];
};

/** The stable surface boundary used by CASE to keep overlapping actions apart. */
export type LlmCatalogRoot = {
	surface: string;
	baseType: string;
};

/** User utterances grouped by the UI language codes supported by the shell. */
export type LlmCatalogExamples = Partial<Record<
	"en" | "ru" | "de" | "fr" | "es" | "it" | "pt",
	string[]
>>;

export type SurfaceLlmAction = {
	/** Existing Effector catalog command that performs this UI intent. */
	controller?: string;
	brief: string;
	category: string;
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: LlmCatalogParameters;
	examples?: LlmCatalogExamples;
};

export type SurfaceLlmCatalog = {
	/** Optional hand-written module summary; action descriptions are the fallback. */
	description?: string;
	root?: LlmCatalogRoot;
	actions: Record<string, SurfaceLlmAction>;
	patterns?: Array<{
		prefix: string;
		meta: Omit<SurfaceLlmAction, "access" | "capability">;
	}>;
};
