import type { AppShellMountConfig } from "front-core/shell";

export type MountConfig = AppShellMountConfig;

export function readMountConfig(): MountConfig {
	const required = (name: string): string => {
		const value = process.env[name]?.trim();
		if (!value) throw new Error(`[ssr] missing required env ${name}`);
		return value;
	};

	const chatContext = required("FRONT_CHAT_CONTEXT");
	return {
		fujinWsUrl: required("FUJIN_WS_URL"),
		scope: required("FUJIN_BROWSER_SCOPE"),
		chatContext,
		callContext: required("FRONT_CALL_CONTEXT"),
	};
}
