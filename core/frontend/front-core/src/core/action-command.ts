import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import { actionContext } from "./action-context";
import { registry } from "./registry";

export type ActionCommand = {
	actionId: string;
	params?: unknown;
	source?: "assistant" | "user";
};

const domain = createDomain("action-command");
createDomainLogger(domain);

export const actionCommandRequested = domain.createEvent<ActionCommand>(
	"ACTION_COMMAND_REQUESTED",
);
export const actionCommandActivated = domain.createEvent<ActionCommand>(
	"ACTION_COMMAND_ACTIVATED",
);

type ActionLoader = (actionId: string) => Promise<void>;

let loader: ActionLoader | null = null;

export function setActionCommandLoader(load: ActionLoader): void {
	loader = load;
}

export const actionCommandFx = domain.createEffect<ActionCommand, unknown>({
	name: "ACTION_COMMAND",
	handler: async ({ actionId, params, source = "user" }) => {
		try {
			if (!registry.meta(actionId)) {
				throw new Error(`[front-core] Unknown action: ${actionId}`);
			}

			actionCommandRequested({ actionId, params, source });
			if (!registry.get(actionId) && loader) await loader(actionId);

			const action = registry.get(actionId);
			if (!action) {
				throw new Error(`[front-core] Action did not register: ${actionId}`);
			}

			actionContext.recordInvoke(actionId);
			actionCommandActivated({ actionId, params, source });
			return await registry.run(actionId, params);
		} catch (error) {
			console.error("[action-command] execution failed", {
				actionId,
				params,
				error,
			});
			throw error;
		}
	},
});

/** Resolves and executes a declared action through the logged command effect. */
export function actionCommand(command: ActionCommand): Promise<unknown> {
	return actionCommandFx({ ...command, source: command.source ?? "user" });
}
