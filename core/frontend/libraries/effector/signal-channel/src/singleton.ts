import { SignalChannel, type SignalAuthController } from "./channel";

declare global {
	var __FUJIN_SIGNAL_CHANNEL__: SignalChannel | undefined;
	var __FUJIN_SIGNAL_CHANNEL_AUTOCONNECTED__: boolean | undefined;
}

// Bundles (surfaces, the embeddable widget) can be evaluated
// independently on one page. Keep the transport instance on globalThis so
// every bundle shares one physical socket.
if (!globalThis.__FUJIN_SIGNAL_CHANNEL__) {
	globalThis.__FUJIN_SIGNAL_CHANNEL__ = new SignalChannel();
}
export const signalChannel = globalThis.__FUJIN_SIGNAL_CHANNEL__;

/** Called by the host composition layer after it creates its auth controller. */
export function setSignalChannelAuth(controller: SignalAuthController | null): void {
	signalChannel.setAuthController(controller);
}

// Warm the socket up ahead of the first request — but only when the host has
// already published the endpoint. A bundle that configures the transport itself
// (the embeddable widget, the minimal front) evaluates this module before it
// knows the URL; connecting there would throw out of a microtask with nobody to
// catch it. The lazy connect in sendMessage covers that case.
if (
	typeof window !== "undefined" &&
	!globalThis.__FUJIN_SIGNAL_CHANNEL_AUTOCONNECTED__ &&
	globalThis.__FUJIN_WS_URL__?.trim()
) {
	globalThis.__FUJIN_SIGNAL_CHANNEL_AUTOCONNECTED__ = true;
	queueMicrotask(() => signalChannel.connect());
}
