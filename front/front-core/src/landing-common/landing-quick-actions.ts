export const LANDING_QUICK_ACTIONS_EVENT = "front-core:landing-quick-actions";

export interface LandingQuickAction {
	id?: string;
	icon?: string;
	label: string;
	prompt: string;
	contextName?: string;
}

declare global {
	var __FRONT_CORE_LANDING_QUICK_ACTIONS__: LandingQuickAction[] | undefined;
}

export function publishLandingQuickActions(actions: LandingQuickAction[]): void {
	const normalized = actions
		.map((action, index) => {
			const label = action.label.trim();
			const prompt = action.prompt;
			if (!label || !prompt.trim()) return null;
			return {
				...action,
				id: action.id || toActionId(label, index),
				label,
				prompt,
			};
		})
		.filter((action): action is LandingQuickAction => action !== null);

	globalThis.__FRONT_CORE_LANDING_QUICK_ACTIONS__ = normalized;
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(LANDING_QUICK_ACTIONS_EVENT, {
				detail: { actions: normalized },
			}),
		);
	}
}

export function readPublishedLandingQuickActions(): LandingQuickAction[] {
	return Array.isArray(globalThis.__FRONT_CORE_LANDING_QUICK_ACTIONS__)
		? globalThis.__FRONT_CORE_LANDING_QUICK_ACTIONS__
		: [];
}

function toActionId(label: string, index: number): string {
	const slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || `action-${index + 1}`;
}
