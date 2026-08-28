import type { ActionMeta, ActionPriority } from "./types";

export type ResolvedActionMeta = ActionMeta & {
	brief: string;
	description: string;
	exposure: "llm" | "user";
	priority: ActionPriority;
};

export function actionPriorityWeight(priority: ActionPriority | undefined): number {
	return priority === "primary" ? 2 : priority === "secondary" ? 0 : 1;
}

export function resolveActionMeta(action: ActionMeta): ResolvedActionMeta {
	const description = action.description || action.id;
	const brief = action.brief || description.slice(0, 80);

	return {
		...action,
		brief,
		description,
		exposure: action.exposure ?? "user",
		priority: action.priority ?? "normal",
	};
}
