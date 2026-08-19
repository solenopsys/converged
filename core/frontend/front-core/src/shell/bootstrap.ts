import { loadFunctionIndex } from "front-core/core";
import type { ChatConfig } from "../chat/config";
import { configFromPage } from "../chat/config/from-page";
import { loadMicrofrontend } from "./mf";

export async function bootstrapAppShell(
	mount: (config: ChatConfig) => void,
): Promise<void> {
	await loadMicrofrontend("mf-auth");
	mount(configFromPage());
	void loadFunctionIndex();
}
