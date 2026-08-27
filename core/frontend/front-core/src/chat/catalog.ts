import {
	actionCommand,
	actionContext,
	actionRegistered,
	onActionAuthorizationChanged,
	registry,
	resolveActionMeta,
} from "front-core/core";
import { loadMicrofrontendForAction } from "../shell/mf";
import type { ChatCatalog } from "./store";

// The host half of the orchestrator: this delivery's functions, their registry,
// lazy owner loading and the single invoke point. Kept in its own file because
// it is the only part of the chat layer that pulls front-core/core and the
// microfrontend loader — the embed widget never imports it.

function actionLabel(id: string): string | undefined {
	const meta = registry.meta(id);
	return meta ? resolveActionMeta(meta).brief : undefined;
}

export function createMicrofrontendCatalog(): ChatCatalog {
	return {
		catalog: {
			search: (query, limit) => actionContext.search(query, limit),
			listCategories: () => actionContext.listCategories(),
			// Answers for unloaded modules too: the delivery index declares them.
			meta: (id) => {
				const action = registry.meta(id);
				return action ? resolveActionMeta(action) : undefined;
			},
			invoke: (actionId, params) =>
				actionCommand({ actionId, params, source: "assistant" }),
			load: loadMicrofrontendForAction,
		},
		context: {
			getHot: () => actionContext.getHot(),
			listCategories: () => actionContext.listCategories(),
			listByCategory: (category) => actionContext.listByCategory(category),
			search: (query, limit) => actionContext.search(query, limit),
		},
		label: actionLabel,
		// A microfrontend that registers mid-conversation publishes its functions
		// again, so the next turn can choose them.
		onChange: (republish) => {
			void actionRegistered.watch(() => republish());
			onActionAuthorizationChanged(republish);
		},
		diagnostics: {
			all: () => registry.getAll(),
			meta: (id) => {
				const action = registry.meta(id);
				return action ? resolveActionMeta(action) : undefined;
			},
			loaded: (id) => Boolean(registry.get(id)),
			listCategories: () => actionContext.listUserCategories(),
			listByCategory: (category) => actionContext.listByCategory(category),
			listUserVisible: () => actionContext.listUserVisible(),
			search: (query) => actionContext.searchUser(query),
			invoke: (actionId, params) =>
				actionCommand({ actionId, params, source: "user" }),
		},
	};
}
