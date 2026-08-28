import { type ChatConfig, requireValue } from "../config";
import { createInlineStoreWorker } from "../worker-inline";


export function configFromEmbed(
	host: HTMLElement,
	script: HTMLScriptElement | null,
): ChatConfig {
	const read = (name: string) => host.dataset[name] ?? script?.dataset[name];

	const backendOrigin = new URL(
		requireValue(read("backendUrl"), "data-backend-url"),
		window.location.href,
	).origin;
	const fujinWsUrl = new URL(
		requireValue(read("fujinUrl"), "data-fujin-url"),
		window.location.href,
	);
	if (fujinWsUrl.protocol === "https:") fujinWsUrl.protocol = "wss:";
	else if (fujinWsUrl.protocol === "http:") fujinWsUrl.protocol = "ws:";

	const contextName = requireValue(read("context"), "data-context");

	return {
		fujinWsUrl: fujinWsUrl.href,
		cacheBaseUrl: backendOrigin,
		storageScope: requireValue(read("scope"), "data-scope"),
		contextName,
		callContextName: requireValue(read("callContext"), "data-call-context"),
		language: requireValue(
			read("lang") ?? document.documentElement.lang,
			"data-lang or <html lang>",
		),
		createWorker: createInlineStoreWorker,
	};
}
