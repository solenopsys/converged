/**
 * Consistency, decided by component identity rather than by resemblance.
 *
 * This is the part the concept calls semantic, and most of it turns out not to
 * need a model at all. The question "are these two things supposed to look the
 * same?" is unanswerable from geometry — but the codebase already answers it:
 * `data-slot` (with `data-variant` / `data-size`) says which component an
 * element is. Two elements with the same slot and the same variant are the same
 * component by construction, so a difference between them is a defect, not a
 * judgement call. Grouping by that attribute is what makes
 * `slot/cross-consistency` a deterministic rule instead of a prompt.
 */

import type { UiElement, UiSnapshot } from "../snapshot";
import type { Config, Violation } from "../violation";
import { px, round } from "../violation";
import { type CrossRule, finding, type Rule } from "./common";

const PADDING = [
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
];

/** Properties that decide whether two instances "look the same". */
const SIGNATURE_PROPS = [
	...PADDING,
	"border-top-left-radius",
	"border-bottom-right-radius",
	"font-size",
	"font-weight",
	"color",
	"background-color",
];

function groupKey(element: UiElement): string | null {
	if (!element.slot) return null;
	return element.variant
		? `@${element.slot}[${element.variant}]`
		: `@${element.slot}`;
}

function modeOf(values: string[]): { value: string; count: number } {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	let best = { value: "", count: 0 };
	for (const [value, count] of counts) {
		if (count > best.count) best = { value, count };
	}
	return best;
}

export const siblingPadding: Rule = {
	id: "sibling/padding-consistency",
	severity: "warning",
	about: "siblings of one component share their padding",
	check({ snapshot, config }) {
		const found: Violation[] = [];
		const groups = new Map<string, UiElement[]>();
		for (const element of snapshot.elements) {
			const key = groupKey(element);
			if (!key) continue;
			const bucket = `${element.parent ?? "root"}|${key}`;
			const list = groups.get(bucket) ?? [];
			list.push(element);
			groups.set(bucket, list);
		}
		for (const [, members] of groups) {
			if (members.length < config.minGroup) continue;
			const signature = (element: UiElement) =>
				PADDING.map((prop) => element.style[prop] ?? "").join(" ");
			const mode = modeOf(members.map(signature));
			if (mode.count === members.length) continue;
			// A group where nothing wins is not an inconsistency, it is a list of
			// different things that happen to share a slot.
			if (mode.count <= members.length / 2) continue;
			for (const element of members) {
				if (signature(element) === mode.value) continue;
				found.push(
					finding(siblingPadding, snapshot, element, {
						prop: "padding",
						actual: signature(element),
						expected: mode.value,
						message: `padding differs from its ${mode.count} siblings (${mode.value})`,
					}),
				);
			}
		}
		return found;
	},
};

export const siblingHeight: Rule = {
	id: "sibling/height-consistency",
	severity: "info",
	about: "rows of one component share their height",
	check({ snapshot, config }) {
		const found: Violation[] = [];
		const groups = new Map<string, UiElement[]>();
		for (const element of snapshot.elements) {
			const key = groupKey(element);
			if (!key) continue;
			const bucket = `${element.parent ?? "root"}|${key}`;
			const list = groups.get(bucket) ?? [];
			list.push(element);
			groups.set(bucket, list);
		}
		for (const [, members] of groups) {
			if (members.length < config.minGroup) continue;
			const mode = modeOf(members.map((element) => round(element.box.h)));
			if (mode.count <= members.length / 2) continue;
			const expected = px(mode.value) ?? 0;
			for (const element of members) {
				if (Math.abs(element.box.h - expected) <= 1) continue;
				found.push(
					finding(siblingHeight, snapshot, element, {
						prop: "height",
						actual: round(element.box.h),
						expected: mode.value,
						message: `height ${round(element.box.h)} differs from its ${mode.count} siblings (${mode.value})`,
					}),
				);
			}
		}
		return found;
	},
};

export const crossConsistency: CrossRule = {
	id: "slot/cross-consistency",
	severity: "warning",
	about: "one component looks the same wherever it appears",
	check(snapshots: UiSnapshot[], _spec, _config: Config) {
		const found: Violation[] = [];
		type Variant = {
			count: number;
			targets: Set<string>;
			style: Record<string, string>;
			element: UiElement;
			snapshot: UiSnapshot;
		};
		// Viewport is part of the key: a component is allowed to be a different
		// size on a phone, it is not allowed to be two different sizes on the
		// same phone.
		const groups = new Map<string, Map<string, Variant>>();
		for (const snapshot of snapshots) {
			for (const element of snapshot.elements) {
				const key = groupKey(element);
				if (!key) continue;
				const bucket = `${key}@${snapshot.viewport.name}`;
				const signature = SIGNATURE_PROPS.map(
					(prop) => `${prop}:${element.style[prop] ?? ""}`,
				).join(";");
				const variants = groups.get(bucket) ?? new Map<string, Variant>();
				const seen = variants.get(signature);
				if (seen) {
					seen.count += 1;
					seen.targets.add(snapshot.target);
				} else {
					const style: Record<string, string> = {};
					for (const prop of SIGNATURE_PROPS) {
						style[prop] = element.style[prop] ?? "";
					}
					variants.set(signature, {
						count: 1,
						targets: new Set([snapshot.target]),
						style,
						element,
						snapshot,
					});
				}
				groups.set(bucket, variants);
			}
		}

		for (const [bucket, variants] of groups) {
			if (variants.size < 2) continue;
			const ranked = Array.from(variants.values()).sort(
				(a, b) => b.count - a.count,
			);
			const [majority, ...rest] = ranked;
			// The most common rendering is treated as the intended one and the
			// others are reported against it. Which of them is "right" is not
			// something the tool can know — but it can say exactly how many
			// representations one component has and where each came from.
			for (const variant of rest) {
				const differing = SIGNATURE_PROPS.filter(
					(prop) => variant.style[prop] !== majority.style[prop],
				);
				if (differing.length === 0) continue;
				const where = (entry: Variant) =>
					`${entry.count} in ${Array.from(entry.targets).join("/")}`;
				found.push(
					finding(crossConsistency, variant.snapshot, variant.element, {
						prop: differing.join(","),
						actual: differing
							.map((prop) => `${prop}:${variant.style[prop]}`)
							.join("; "),
						expected: differing
							.map((prop) => `${prop}:${majority.style[prop]}`)
							.join("; "),
						message: `${bucket} has ${variants.size} looks; this one (${where(variant)}) differs from the most common (${where(majority)}) on ${differing.join(", ")}`,
					}),
				);
			}
		}
		// The group key is the identity here, not the element path: the same
		// finding must keep its fingerprint even when the sample element that
		// illustrated it moves.
		return found.map((violation) => ({
			...violation,
			path: `${violation.slot ? `@${violation.slot}` : violation.path}`,
		}));
	},
};

export const CONSISTENCY_RULES: Rule[] = [siblingPadding, siblingHeight];
export const CROSS_RULES: CrossRule[] = [crossConsistency];
