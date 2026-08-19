import type { ComponentChildren } from "preact";

export interface AppShellMountConfig {
	fujinWsUrl: string;
	scope: string;
	chatContext: string;
	callContext: string;
}

export function AppShellFrame({
	children,
	mount,
}: {
	children: ComponentChildren;
	mount: AppShellMountConfig;
}) {
	return (
		<div
			id="app"
			data-chat-context={mount.chatContext}
			data-call-context={mount.callContext}
			data-fujin-url={mount.fujinWsUrl}
			data-scope={mount.scope}
		>
			<main class="app-shell">
				<div class="app-shell-stage">{children}</div>
			</main>
		</div>
	);
}
