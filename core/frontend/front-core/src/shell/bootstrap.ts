import { loadObjectIndex } from "front-core/object-runtime";
import type { ChatConfig } from "../chat/config";
import { configFromPage } from "../chat/config/from-page";
import { loadMicrofrontend } from "./mf";
import { bootstrapWorkspaceUrl } from "./workspace-url";

export async function bootstrapAppShell(
	mount: (config: ChatConfig) => void,
): Promise<void> {
	await loadObjectIndex();
	await loadMicrofrontend("mf-auth");
	mount(configFromPage());
	bootstrapWorkspaceUrl();
}
