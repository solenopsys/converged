import { loadObjectIndex } from "front-core/object-runtime";
import type { ChatConfig } from "../chat/config";
import { configFromPage } from "../chat/config/from-page";
import { LocaleController } from "../i18n";
import { loadSurface } from "./sf";
import { bootstrapWorkspaceUrl } from "./workspace-url";

export async function bootstrapAppShell(
	mount: (config: ChatConfig) => void,
): Promise<void> {
	LocaleController.getInstance().hydrateFromPath(window.location.pathname);
	await loadObjectIndex();
	await loadSurface("sf-auth");
	mount(configFromPage());
	bootstrapWorkspaceUrl();
}
