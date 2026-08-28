/**
 * Shared state: effector itself and its preact binding. One file for both
 * specifiers — microfrontend models and shell stores must live in the same
 * graph, otherwise the surface controller's subscription won't see MF events.
 */
export * from "effector";
export { useUnit } from "effector-preact";
