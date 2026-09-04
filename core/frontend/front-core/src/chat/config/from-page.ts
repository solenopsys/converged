import { type ChatConfig, requireValue } from "../config";

const STORE_WORKER_URL = "/assets/store.worker.js";



function mountUrl(value: string | undefined, name: string): URL {
	return new URL(requireValue(value, name), window.location.href);
}


function websocketUrl(value: string | undefined, name: string): string {
	const url = mountUrl(value, name);
	if (url.protocol === "https:") url.protocol = "wss:";
	else if (url.protocol === "http:") url.protocol = "ws:";
	return url.href;
}

export function configFromPage(): ChatConfig {
	const mount = document.getElementById("app");
	if (!mount) throw new Error("[chat] missing #app mount point");

	const contextName = requireValue(
		mount.dataset.chatContext,
		"#app[data-chat-context]",
	);
	const fujinWsUrl = websocketUrl(
		mount.dataset.fujinUrl,
		"#app[data-fujin-url]",
	);
	// Surfaces are loaded after the shell and use this shared bootstrap.
	globalThis.__FUJIN_WS_URL__ = fujinWsUrl;

	return {
		fujinWsUrl,
		cacheBaseUrl: window.location.origin,
		storageScope: requireValue(mount.dataset.scope, "#app[data-scope]"),
		contextName,
		callContextName: requireValue(
			mount.dataset.callContext,
			"#app[data-call-context]",
		),
		language: requireValue(document.documentElement.lang, "<html lang>"),
		createWorker: () => new Worker(STORE_WORKER_URL, { type: "module" }),
	};
}
