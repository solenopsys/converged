import type { ExecutableTool } from "assistant-state";
import { registerSlashSection } from "./registry";
import type { SlashSection } from "./types";




export type CatalogView = {
	all(): Array<{ id: string; brief?: string; description: string; category?: string }>;
	meta(
		id: string,
	): { id: string; brief?: string; description: string; category?: string } | undefined;

	loaded(id: string): boolean;
	listCategories(): Array<{ id: string; count: number }>;
	listByCategory(category: string): Array<{ id: string; brief: string }>;
	search(query: string): Array<{ id: string; brief: string }>;
};

const code = (lines: string[]): string => ["```", ...lines, "```"].join("\n");

const functionsSection = (catalog: CatalogView): SlashSection => {
	const describe = (id: string): string => {
		const meta = catalog.meta(id);
		if (!meta) return `Function \`${id}\` not found.`;
		return [
			`**${meta.id}** — ${meta.brief ?? meta.description.slice(0, 80)}`,
			"",
			meta.description,
			"",
			`category: \`${meta.category ?? "—"}\` · module ${
				catalog.loaded(id) ? "loaded" : "loads on call"
			}`,
		].join("\n");
	};

	const listLine = (id: string, brief: string): string =>
		`${catalog.loaded(id) ? "●" : "○"} ${id.padEnd(28)} ${brief}`;

	return {
		name: "functions",
		description: "Catalog of functions available to the chat",
		commands: {
			list: {
				description: "Every function; with an argument — one category only",
				handler: (param) => {
					const all = param
						? catalog.listByCategory(param.trim())
						: catalog.all().map((action) => ({
								id: action.id,
								brief: action.brief ?? action.description.slice(0, 80),
							}));
					if (all.length === 0) return "Nothing found.";
					return [
						`Functions: ${all.length} (● module loaded, ○ declared by the index)`,
						code(all.map((fn) => listLine(fn.id, fn.brief))),
					].join("\n\n");
				},
			},
			search: {
				description: "Search across ids, briefs and descriptions",
				handler: (param) => {
					if (!param) return "Usage: `/functions search <query>`";
					const found = catalog.search(param);
					if (found.length === 0) return `Nothing found for "${param}".`;
					return code(found.map((fn) => listLine(fn.id, fn.brief)));
				},
			},
			show: {
				description: "Full description of a single function",
				handler: (param) =>
					param ? describe(param.trim()) : "Usage: `/functions show <id>`",
			},
		},
		fallback: () => {
			const categories = catalog.listCategories();
			const total = catalog.all().length;
			if (total === 0) {
				return "Catalog is empty: the function index did not load — check `/mf/index.json`.";
			}
			return [
				`Functions in the catalog: **${total}**, categories: **${categories.length}**`,
				code(
					categories
						.sort((a, b) => b.count - a.count)
						.map(({ id, count }) => `${id.padEnd(20)} ${count}`),
				),
				"`/functions list [category]` · `/functions search <query>` · `/functions show <id>`",
			].join("\n\n");
		},
	};
};


const toolsSection = (
	readTools: () => ExecutableTool[],
	catalog?: CatalogView,
): SlashSection => ({
	name: "tools",
	description: "Tools that go to the model with the next request",
	fallback: () => {
		const tools = readTools();
		if (tools.length === 0) return "No tools go to the model.";
		const total = catalog?.all().length ?? 0;
		return [
			total > 0
				? `The model sees **${tools.length}** tools while the catalog holds **${total}** functions: ` +
					"the orchestrator steps pick the function, not the model."
				: `The model sees **${tools.length}** tools.`,
			code(tools.map((tool) => `${tool.name.padEnd(24)} ${tool.description.slice(0, 60)}`)),
		].join("\n\n");
	},
});

export type ContextSnapshot = {
	contextName?: string;
	language?: string;
	prompt?: string;
};

const contextSection = (read: () => Promise<ContextSnapshot>): SlashSection => ({
	name: "context",
	description: "The instruction the model works with",
	fallback: async () => {
		const { contextName, language, prompt } = await read();
		if (!prompt) {
			return [
				`Context: \`${contextName ?? "—"}\` (${language ?? "—"})`,
				"",
				"The instruction does not resolve — ms-contexts returned no record, so the model runs without a prompt.",
			].join("\n");
		}
		return [
			`Context \`${contextName}\` (${language}), ${prompt.length} characters:`,
			code(prompt.split("\n").slice(0, 40)),
		].join("\n\n");
	},
});

export function registerBuiltinSlashCommands(options: {
	readTools: () => ExecutableTool[];
	readContext: () => Promise<ContextSnapshot>;

	catalog?: CatalogView;
}): void {
	if (options.catalog) registerSlashSection(functionsSection(options.catalog));
	registerSlashSection(toolsSection(options.readTools, options.catalog));
	registerSlashSection(contextSection(options.readContext));
}
