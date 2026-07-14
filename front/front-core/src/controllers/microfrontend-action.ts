import { bus } from "./bus";
import { registry } from "./registry";

const loads = new Map<string, Promise<void>>();

async function ensureActionModule(actionId: string): Promise<void> {
	if (registry.get(actionId)) return;
	const domain = actionId.split(".", 1)[0]?.trim();
	if (!domain) throw new Error(`Invalid microfrontend action: ${actionId}`);
	const moduleName = `mf-${domain}`;
	let load = loads.get(moduleName);
	if (!load) {
		load = import(/* @vite-ignore */ moduleName).then((runtime) => {
			if (runtime?.default?.plug) runtime.default.plug(bus);
		});
		loads.set(moduleName, load);
	}
	await load;
}

/** Invoke an action while preserving lazy microfrontend ownership. */
export async function requestMicrofrontendAction(
	actionId: string,
	params: unknown,
): Promise<void> {
	await ensureActionModule(actionId);
	registry.run(actionId, params);
}
