import { actionCommand, setActionCommandLoader } from "./action-command";

export function setActionLoader(
	load: (actionId: string) => Promise<void>,
): void {
	setActionCommandLoader(load);
}

export async function invokeAction(
	actionId: string,
	params?: unknown,
): Promise<unknown> {
	return actionCommand({ actionId, params });
}
