/**
 * Rules about what the layout does to the user, not about taste.
 *
 * These are the findings worth waking someone up for. "Two cards have different
 * radii" is a design-system debt; "the order form is cut off at 390px" is a
 * person who cannot place an order. Everything here is an `error` and none of
 * it needs interpretation: a horizontal overflow on a non-scrollable box is not
 * a matter of opinion.
 */

import type { Violation } from "../violation";
import { round } from "../violation";
import { finding, type Rule } from "./common";

const SCROLLABLE = ["auto", "scroll", "overlay"];

export const horizontalOverflow: Rule = {
	id: "layout/overflow",
	severity: "error",
	about: "content is not wider than the box that holds it",
	check({ snapshot, config }) {
		const found: Violation[] = [];
		for (const element of snapshot.elements) {
			const { scrollW, clientW } = element.scroll;
			if (clientW === 0) continue;
			const overflow = scrollW - clientW;
			if (overflow <= Math.max(1, config.tolerancePx)) continue;
			// Where the author asked for a scroller, overflow is the feature.
			const behaviour = element.style["overflow-x"] ?? "";
			if (SCROLLABLE.includes(behaviour)) continue;
			// `visible` does not hide anything — the content spills into the
			// ancestors, and every one of them reports the same scrollWidth. The
			// spill is worth one finding at the element that is actually too
			// wide, which is what `layout/viewport-overflow` reports; this rule
			// keeps to the case where the user loses content: it is clipped.
			if (behaviour === "visible") continue;
			found.push(
				finding(horizontalOverflow, snapshot, element, {
					prop: "overflow-x",
					actual: `content ${scrollW}px in ${clientW}px`,
					expected: "content fits",
					message: `content overflows by ${round(overflow)} and is clipped`,
				}),
			);
		}
		return found;
	},
};

export const viewportOverflow: Rule = {
	id: "layout/viewport-overflow",
	severity: "error",
	about: "nothing reaches past the right edge of the viewport",
	check({ snapshot, config }) {
		const found: Violation[] = [];
		const limit = snapshot.viewport.width + Math.max(1, config.tolerancePx);
		for (const element of snapshot.elements) {
			const right = element.box.x + element.box.w;
			if (right <= limit) continue;
			// Only the outermost offender is worth reporting: its children are
			// past the edge because it is.
			const parent = element.parent;
			if (
				parent !== null &&
				snapshot.elements[parent] &&
				snapshot.elements[parent].box.x + snapshot.elements[parent].box.w >
					limit
			) {
				continue;
			}
			found.push(
				finding(viewportOverflow, snapshot, element, {
					prop: "box",
					actual: `right edge at ${round(right)}`,
					expected: `within ${snapshot.viewport.width}px`,
					message: `extends ${round(right - snapshot.viewport.width)} past the viewport at ${snapshot.viewport.name}`,
				}),
			);
		}
		return found;
	},
};

export const touchTarget: Rule = {
	id: "a11y/touch-target",
	severity: "warning",
	about: "interactive elements are big enough to hit",
	check({ snapshot, config }) {
		const found: Violation[] = [];
		const min = config.minTouchTarget;
		for (const element of snapshot.elements) {
			if (!element.interactive) continue;
			const { w, h } = element.box;
			if (w === 0 || h === 0) continue;
			if (w >= min - config.tolerancePx && h >= min - config.tolerancePx) {
				continue;
			}
			found.push(
				finding(touchTarget, snapshot, element, {
					prop: "box",
					actual: `${round(w)} x ${round(h)}`,
					expected: `at least ${min}px x ${min}px`,
					message: `${element.name ? `"${element.name}"` : element.tag} is ${round(w)} x ${round(h)}, below the ${min}px target`,
				}),
			);
		}
		return found;
	},
};

export const LAYOUT_RULES: Rule[] = [
	horizontalOverflow,
	viewportOverflow,
	touchTarget,
];
