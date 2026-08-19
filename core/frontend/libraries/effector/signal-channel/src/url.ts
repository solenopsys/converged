declare global {
	var __FUJIN_WS_URL__: string | undefined;
}

export function defaultSignalUrl(): string {
	const url = globalThis.__FUJIN_WS_URL__?.trim();
	if (!url) {
		throw new Error("Missing required Fujin WebSocket URL configuration");
	}
	return url;
}
