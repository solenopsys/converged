import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { ContextObject } from "./context";

// ── Action IDs ───────────────────────────────────────────────────────────────
export const SHOW_CONTEXTS = "contexts.show";

// ── Widget factories ─────────────────────────────────────────────────────────
// ── Action creators ──────────────────────────────────────────────────────────
const createShowContextsAction: CreateAction = () => ({
	id: SHOW_CONTEXTS,
	invoke: () => {
		void presentReference(setRef(ContextObject.type, { kind: "query" }));
	},
});

const ACTIONS = [createShowContextsAction];

export { createShowContextsAction };

export default ACTIONS;
