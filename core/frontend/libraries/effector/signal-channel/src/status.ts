import { createEvent, createStore } from "effector";

export type SignalStatus = "idle" | "connecting" | "connected" | "reconnecting";

export const statusChanged = createEvent<SignalStatus>();

export const $signalStatus = createStore<SignalStatus>("idle").on(
	statusChanged,
	(_, status) => status,
);
