/**
 * Turning the evidence about one target into a single status.
 *
 * Ordered most specific first. A file can be several things at once — stale
 * *and* structurally drifted — and the status names the one a reader has to
 * act on, while `reasons` keeps the rest.
 *
 * The content-addressed index is authoritative for translation freshness;
 * scan state only adds diagnostics about changes since the previous run.
 */

import type { StoreVerdict } from "./store";
import type { TargetStatus, TreeDiff } from "./types";

export type Evidence = {
	/** Whether a previous scan knew about this target. */
	tracked: boolean;
	targetExists: boolean;
	/** Source hash differs from the previous scan's baseline. */
	sourceChanged: boolean;
	/** Target hash differs from the previous scan's baseline. */
	targetModified: boolean;
	invalidJson: boolean;
	index: StoreVerdict;
	diff?: TreeDiff;
};

function hasStructureDrift(diff: TreeDiff | undefined): boolean {
	if (!diff) return false;
	return (
		diff.missing.length > 0 ||
		diff.extra.length > 0 ||
		diff.typeChanged.length > 0
	);
}

export function statusFor(evidence: Evidence): {
	status: TargetStatus;
	reasons: string[];
} {
	const { diff } = evidence;
	const reasons: string[] = [];

	if (!evidence.targetExists) reasons.push("missing target");
	if (!evidence.tracked && evidence.targetExists)
		reasons.push("untracked target");
	if (evidence.index === "unrecorded" && evidence.targetExists) {
		reasons.push("not in translation index");
	}
	if (evidence.sourceChanged) reasons.push("source changed");
	if (evidence.targetModified) reasons.push("target modified");
	if (evidence.invalidJson) reasons.push("invalid JSON");
	if (hasStructureDrift(diff)) reasons.push("structure drift");
	if (diff?.unchangedStrings.length) reasons.push("unchanged strings");
	if (diff?.localeMismatches.length) reasons.push("locale metadata mismatch");

	let status: TargetStatus = "ok";
	if (evidence.invalidJson) status = "invalid-json";
	else if (!evidence.targetExists) status = "missing";
	else if (hasStructureDrift(diff)) status = "structure-drift";
	else if (diff?.unchangedStrings.length || diff?.localeMismatches.length) {
		status = "untranslated-text";
	} else if (evidence.index === "unrecorded") status = "unrecorded";
	else if (evidence.sourceChanged) status = "source-changed";
	else if (evidence.targetModified) status = "target-modified";
	else if (!evidence.tracked) status = "untracked";

	return { status, reasons };
}
