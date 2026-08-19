import { registry } from "./registry";

export interface ActionBrief {
	id: string;
	brief: string;
	category?: string;
	access?: "public";
	capability?: string;
}

export interface CategorySummary {
	id: string;
	count: number;
}

interface RegistryLike {
	getAll(): Array<{
		id: string;
		brief?: string;
		description: string;
		category?: string;
		access?: "public";
		capability?: string;
	}>;
}


export class ActionContextManager {
	private hot: string[] = [];
	private readonly maxHot = 10;

	constructor(private readonly reg: RegistryLike) {}

	recordInvoke(id: string): void {
		this.hot = [id, ...this.hot.filter((known) => known !== id)].slice(0, this.maxHot);
	}

	getHot(): ActionBrief[] {
		const known = new Map(this.reg.getAll().map((action) => [action.id, action]));
		return this.hot
			.map((id) => known.get(id))
			.filter((action): action is NonNullable<typeof action> => action !== undefined)
			.map(toBrief);
	}

	listCategories(): CategorySummary[] {
		const counts = new Map<string, number>();
		for (const action of this.reg.getAll()) {
			const category = action.category ?? categoryOf(action.id);
			counts.set(category, (counts.get(category) ?? 0) + 1);
		}
		return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
	}

	listByCategory(category: string): ActionBrief[] {
		return this.reg
			.getAll()
			.filter((action) => (action.category ?? categoryOf(action.id)) === category)
			.map(toBrief);
	}


	search(query: string, limit = 15): ActionBrief[] {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return [];
		return this.reg
			.getAll()
			.map((action) => {
				const text =
					`${action.id} ${action.brief ?? ""} ${action.description}`.toLowerCase();
				return { action, score: words.filter((word) => text.includes(word)).length };
			})
			.filter(({ score }) => score > 0)
			.sort((left, right) => right.score - left.score)
			.slice(0, limit)
			.map(({ action }) => toBrief(action));
	}
}


function categoryOf(id: string): string {
	return id.split(".", 1)[0] ?? "other";
}

function toBrief(action: {
	id: string;
	brief?: string;
	description: string;
	category?: string;
}): ActionBrief {
	return {
		id: action.id,
		brief: action.brief ?? action.description.slice(0, 80),
		category: action.category ?? categoryOf(action.id),
	};
}

export const actionContext = new ActionContextManager(registry);
