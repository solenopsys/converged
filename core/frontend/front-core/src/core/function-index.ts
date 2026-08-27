import { registry } from "./registry";



export type FunctionIndexEntry = {
	id: string;
	brief?: string;
	category: string;
	description?: string;
	llm?: {
		microfrontend: string;
		brief: string;
		description: string;
		messages?: Record<string, { brief: string; description: string }>;
	};
	exposure?: "llm" | "user";
	priority?: "primary" | "normal" | "secondary";
	access?: "public";
	capability?: string;
};

export type FunctionIndexModule = {
	module: string;
	brief: string;
	functions: FunctionIndexEntry[];
};

export type FunctionIndexFile = {
	modules: Record<string, FunctionIndexModule>;
};


const owners = new Map<string, string>();


const moduleBriefs = new Map<string, string>();

export function ingestFunctionIndex(index: FunctionIndexFile): void {
	for (const entry of Object.values(index.modules)) {
		moduleBriefs.set(entry.module, entry.brief);
		for (const fn of entry.functions) {
			owners.set(fn.id, entry.module);
			registry.declare(fn);
		}
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
