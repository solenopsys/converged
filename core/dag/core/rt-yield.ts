// After a node body runs, the prelude throws a bare sentinel object
// ({ __rtYield: true }) to unwind out of the evaluation — one node per step.
// Any try/catch a workflow puts around a node call (error boundaries like
// Run.guard) MUST rethrow that sentinel, or the engine never sees the yield
// and the caught "error" is the sentinel itself.

export function isRtYield(e: unknown): boolean {
	return typeof e === "object" && e !== null && (e as { __rtYield?: unknown }).__rtYield === true;
}
