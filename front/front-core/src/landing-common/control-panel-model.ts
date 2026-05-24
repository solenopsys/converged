import { createEvent, createStore } from "effector";

export type ControlPanelMode = "public" | "app";

export const controlPanelOpenChanged = createEvent<boolean>();
export const controlPanelModeChanged = createEvent<ControlPanelMode>();
export const controlPanelOpened = createEvent();
export const controlPanelClosed = createEvent();

export const $isControlPanelOpen = createStore(false)
	.on(controlPanelOpenChanged, (_, isOpen) => isOpen)
	.on(controlPanelModeChanged, (_, mode) => mode === "app")
	.on(controlPanelOpened, () => true)
	.on(controlPanelClosed, () => false);

export const $controlPanelMode = $isControlPanelOpen.map<ControlPanelMode>(
	(isOpen) => (isOpen ? "app" : "public"),
);

export function readControlPanelMode(): ControlPanelMode {
	return $controlPanelMode.getState();
}
