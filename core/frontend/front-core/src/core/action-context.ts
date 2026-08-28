import { registry } from "./registry";
import { actionPriorityWeight, resolveActionMeta } from "./action-meta";
import type { ActionExposure, ActionParameters, ActionPriority } from "./types";

export interface ActionBrief {
	id: string;
	brief: string;
	description: string;
	category?: string;
	access?: "public";
	capability?: string;
	exposure: ActionExposure;
	priority: ActionPriority;
	parameters?: ActionParameters;
}

export interface CategorySummary {
	id: string;
	count: number;
}

interface RegistryLike {
	getAll(): Array<{
		id: string;
		brief?: string;
		description?: string;
		category?: string;
		access?: "public";
		capability?: string;
		exposure?: ActionExposure;
		priority?: ActionPriority;
		parameters?: ActionParameters;
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
			.map(resolveActionMeta)
			.map(toBrief);
	}

	listCategories(): CategorySummary[] {
		return categoriesOf(this.reg.getAll().map(resolveActionMeta));
	}

	listUserCategories(): CategorySummary[] {
		return categoriesOf(
			this.reg.getAll().map(resolveActionMeta).filter((action) => action.exposure === "user"),
		);
	}

	listByCategory(category: string): ActionBrief[] {
		return this.reg.getAll()
			.map(resolveActionMeta)
			.filter(
				(action) =>
					action.exposure === "user" &&
					(action.category ?? categoryOf(action.id)) === category,
			)
			.sort(comparePriority)
			.map(toBrief);
	}

	listUserVisible(): ActionBrief[] {
		return this.reg
			.getAll()
			.map(resolveActionMeta)
			.filter((action) => action.exposure === "user")
			.sort(comparePriority)
			.map(toBrief);
	}

	searchUser(query: string, limit = 15): ActionBrief[] {
		return this.searchInternal(query, limit, "user");
	}

	search(query: string, limit = 15): ActionBrief[] {
		return this.searchInternal(query, limit);
	}

	private searchInternal(
		query: string,
		limit: number,
		exposure?: ActionExposure,
	): ActionBrief[] {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return [];
		return this.reg.getAll()
			.map(resolveActionMeta)
			.filter((action) => !exposure || action.exposure === exposure)
			.map((action) => {
				const text = `${action.id} ${action.brief} ${action.description}`.toLowerCase();
				return { action, score: words.filter((word) => text.includes(word)).length };
			})
			.filter(({ score }) => score > 0)
			.sort((left, right) =>
				right.score - left.score || comparePriority(left.action, right.action),
			)
			.slice(0, limit)
			.map(({ action }) => toBrief(action));
	}

}

function categoriesOf(actions: ReturnType<typeof resolveActionMeta>[]): CategorySummary[] {
	const counts = new Map<string, number>();
	for (const action of actions) {
		const category = action.category ?? categoryOf(action.id);
		counts.set(category, (counts.get(category) ?? 0) + 1);
	}
	return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
}


function categoryOf(id: string): string {
	return id.split(".", 1)[0] ?? "other";
}

function comparePriority(
	left: { priority?: ActionPriority; id: string },
	right: { priority?: ActionPriority; id: string },
): number {
	return actionPriorityWeight(right.priority) - actionPriorityWeight(left.priority) ||
		left.id.localeCompare(right.id);
}

function toBrief(action: ReturnType<typeof resolveActionMeta>): ActionBrief {
	return {
		id: action.id,
		brief: action.brief,
		description: action.description,
		category: action.category ?? categoryOf(action.id),
		exposure: action.exposure,
		priority: action.priority,
		...(action.parameters ? { parameters: action.parameters } : {}),
	};
}

export const actionContext = new ActionContextManager(registry);
