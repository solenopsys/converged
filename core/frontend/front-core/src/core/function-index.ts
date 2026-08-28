import { registry } from "./registry";



export type FunctionIndexEntry = {
	id: string;
	brief: string;
	category: string;
	description: string;
	exposure: "llm" | "user";
	priority: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
	parameters?: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

export type FunctionIndexModule = {
	module: string;
	brief: string;
	functions: FunctionIndexEntry[];
};

export type FunctionIndexFile = {
	modules: Record<string, FunctionIndexModule>;
};

export type MicrofrontendLlmCatalog = {
	actions: Record<string, Omit<FunctionIndexEntry, "id">>;
	patterns?: Array<{
		prefix: string;
		meta: Omit<FunctionIndexEntry, "id" | "access" | "capability">;
	}>;
};


const owners = new Map<string, string>();


const moduleBriefs = new Map<string, string>();

export function ingestFunctionIndex(index: FunctionIndexFile): void {
	for (const entry of Object.values(index.modules)) {
		ingestMicrofrontendLlmCatalog(entry.module, entry.brief, {
			actions: Object.fromEntries(entry.functions.map(({ id, ...meta }) => [id, meta])),
		});
	}
}

/** Registers the LLM manifest embedded in an individual microfrontend bundle. */
export function ingestMicrofrontendLlmCatalog(
	module: string,
	brief: string,
	catalog: MicrofrontendLlmCatalog,
): void {
	moduleBriefs.set(module, brief);
	for (const [id, meta] of Object.entries(catalog.actions)) {
		owners.set(id, module);
		registry.declare({ id, ...meta });
	}
	for (const pattern of catalog.patterns ?? []) {
		registry.declarePattern(pattern.prefix, pattern.meta);
	}
}


export function moduleForAction(actionId: string): string | undefined {
	const known = owners.get(actionId);
	if (known) return known;
	const domain = actionId.split(".", 1)[0]?.trim();
	return domain ? `mf-${domain}` : undefined;
}

export function modules(): Array<{ module: string; brief: string }> {
	return Array.from(moduleBriefs, ([module, brief]) => ({ module, brief }));
}


export async function loadFunctionIndex(url = "/mf/index.json"): Promise<void> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		ingestFunctionIndex((await response.json()) as FunctionIndexFile);
	} catch (error) {
		console.warn(`[front-core] Function index unavailable (${url}):`, error);
	}
}
