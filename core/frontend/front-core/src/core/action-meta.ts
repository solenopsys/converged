import { $activeLocale, resolveEmbeddedMicrofrontendMessage } from "../i18n";
import type { ActionLlmFragment, ActionMeta, ActionPriority } from "./types";

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
	const fragment = action.llm;
	const message = fragment ? indexedMessage(fragment.messages) : undefined;
	const translatedBrief = fragment
		? resolveEmbeddedMicrofrontendMessage(fragment.microfrontend, fragment.brief)
		: undefined;
	const translatedDescription = fragment
		? resolveEmbeddedMicrofrontendMessage(fragment.microfrontend, fragment.description)
		: undefined;
	const description =
		(typeof translatedDescription === "string" && translatedDescription.trim()) ||
		message?.description ||
		action.description ||
		action.id;
	const brief =
		(typeof translatedBrief === "string" && translatedBrief.trim()) ||
		message?.brief ||
		action.brief ||
		description.slice(0, 80);

	return {
		...action,
		brief,
		description,
		exposure: action.exposure ?? "user",
		priority: action.priority ?? "normal",
	};
}

function indexedMessage(
	messages: ActionLlmFragment["messages"],
): { brief: string; description: string } | undefined {
	if (!messages || typeof messages !== "object") return undefined;
	const language = $activeLocale.getState().toLowerCase();
	const shortLanguage = language?.split("-")[0];
	const values = messages as Record<string, { brief: string; description: string }>;
	return (language && values[language]) ||
		(shortLanguage && values[shortLanguage]) ||
		values.en ||
		Object.values(values)[0];
}
