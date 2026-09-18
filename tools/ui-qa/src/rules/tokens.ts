/**
 * Design-token conformance: does the rendered value exist in the system?
 *
 * The allowed sets come from `probeSpec`, i.e. from `tokens.css` itself, so
 * these rules never disagree with the design system — they are the design
 * system, asked of the pixels the user actually got.
 *
 * Two rules cover spacing on purpose. `grid-conformance` is the one that finds
 * real mistakes (a hand-typed `13px` is not a multiple of 4) and is a warning.
 * `scale-conformance` is stricter than the codebase currently is — plenty of
 * legitimate values are `calc(unit * 3.5)` and appear nowhere as a token — so
 * it ships as `info` and is there for teams that want the tighter contract.
 */

import type { Violation } from "../violation";
import { colorDistance, nearest, onScale, px, rgba, round } from "../violation";
import { finding, type Rule } from "./common";

/**
 * Longhands, grouped by the shorthand an author actually wrote.
 *
 * `padding: 13px` renders as four wrong longhands. Reporting four findings for
 * one mistake inflates every count by four and makes the report read as if the
 * page were four times worse than it is, so sides that share a bad value are
 * collapsed back into the shorthand they came from.
 */
const FAMILIES = [
	{
		name: "padding",
		props: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
	},
	{
		name: "margin",
		props: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
	},
	{ name: "gap", props: ["row-gap", "column-gap"] },
];

const RADIUS_FAMILY = {
	name: "border-radius",
	props: [
		"border-top-left-radius",
		"border-top-right-radius",
		"border-bottom-right-radius",
		"border-bottom-left-radius",
	],
};

type Offender = { prop: string; value: number };

function offenders(
	style: Record<string, string>,
	family: { name: string; props: string[] },
	bad: (value: number) => boolean,
): Offender[] {
	const byValue = new Map<number, string[]>();
	for (const prop of family.props) {
		const value = px(style[prop]);
		if (value === null || value === 0) continue;
		if (!bad(value)) continue;
		const key = Math.round(value * 100) / 100;
		byValue.set(key, [...(byValue.get(key) ?? []), prop]);
	}
	return Array.from(byValue).map(([value, props]) => ({
		prop: props.length === family.props.length ? family.name : props.join(","),
		value,
	}));
}

export const spacingGrid: Rule = {
	id: "spacing/grid-conformance",
	severity: "warning",
	about: "padding, margin and gap land on the base unit",
	check({ snapshot, spec, config }) {
		const found: Violation[] = [];
		const unit = spec.baseUnit;
		if (!unit) return found;
		const offBy = (value: number): number => {
			const rest = Math.abs(value) % unit;
			return Math.min(rest, unit - rest);
		};
		for (const element of snapshot.elements) {
			for (const family of FAMILIES) {
				const bad = offenders(
					element.style,
					family,
					(value) => offBy(value) > config.tolerancePx,
				);
				for (const { prop, value } of bad) {
					found.push(
						finding(spacingGrid, snapshot, element, {
							prop,
							actual: round(value),
							expected: `multiple of ${round(unit)}`,
							message: `${prop} ${round(value)} is off the ${round(unit)} grid by ${round(offBy(value))}`,
						}),
					);
				}
			}
		}
		return found;
	},
};

export const spacingScale: Rule = {
	id: "spacing/scale-conformance",
	severity: "info",
	about: "padding, margin and gap come from a spacing token",
	check({ snapshot, spec, config }) {
		const found: Violation[] = [];
		if (spec.spacing.length === 0) return found;
		for (const element of snapshot.elements) {
			for (const family of FAMILIES) {
				const bad = offenders(
					element.style,
					family,
					(value) =>
						!onScale(spec.spacing, Math.abs(value), config.tolerancePx),
				);
				for (const { prop, value } of bad) {
					found.push(
						finding(spacingScale, snapshot, element, {
							prop,
							actual: round(value),
							expected: `one of ${spec.spacing.join(", ")}`,
							message: `${prop} ${round(value)} is not a spacing token (nearest ${round(nearest(spec.spacing, Math.abs(value)) ?? 0)})`,
						}),
					);
				}
			}
		}
		return found;
	},
};

export const radiusScale: Rule = {
	id: "radius/scale-conformance",
	severity: "warning",
	about: "border-radius comes from a radius token",
	check({ snapshot, spec, config }) {
		const found: Violation[] = [];
		if (spec.radius.length === 0) return found;
		for (const element of snapshot.elements) {
			const bad = offenders(
				element.style,
				RADIUS_FAMILY,
				(value) => !onScale(spec.radius, value, config.tolerancePx),
			);
			for (const { prop, value } of bad) {
				found.push(
					finding(radiusScale, snapshot, element, {
						prop,
						actual: round(value),
						expected: `one of ${spec.radius.join(", ")}`,
						message: `${prop} ${round(value)} is not a radius token (nearest ${round(nearest(spec.radius, value) ?? 0)})`,
					}),
				);
			}
		}
		return found;
	},
};

export const typeScale: Rule = {
	id: "type/scale-conformance",
	severity: "warning",
	about: "font-size comes from a type token",
	check({ snapshot, spec, config }) {
		const found: Violation[] = [];
		if (spec.fontSizes.length === 0) return found;
		for (const element of snapshot.elements) {
			if (!element.text) continue;
			const value = px(element.style["font-size"]);
			if (value === null) continue;
			if (onScale(spec.fontSizes, value, config.tolerancePx)) continue;
			found.push(
				finding(typeScale, snapshot, element, {
					prop: "font-size",
					actual: round(value),
					expected: `one of ${spec.fontSizes.join(", ")}`,
					message: `font-size ${round(value)} is not a type token (nearest ${round(nearest(spec.fontSizes, value) ?? 0)})`,
				}),
			);
		}
		return found;
	},
};

export const typeWeight: Rule = {
	id: "type/weight-conformance",
	severity: "warning",
	about: "font-weight is one the system declares",
	check({ snapshot, spec }) {
		const found: Violation[] = [];
		if (spec.fontWeights.length === 0) return found;
		for (const element of snapshot.elements) {
			if (!element.text) continue;
			const value = Number.parseFloat(element.style["font-weight"] ?? "");
			if (!Number.isFinite(value)) continue;
			if (spec.fontWeights.includes(value)) continue;
			found.push(
				finding(typeWeight, snapshot, element, {
					prop: "font-weight",
					actual: String(value),
					expected: spec.fontWeights.join(", "),
					message: `font-weight ${value} is not a declared weight`,
				}),
			);
		}
		return found;
	},
};

export const typeFamily: Rule = {
	id: "type/family-conformance",
	severity: "warning",
	about: "text uses an approved font family",
	check({ snapshot, spec }) {
		const found: Violation[] = [];
		if (spec.fontFamilies.length === 0) return found;
		for (const element of snapshot.elements) {
			if (!element.text) continue;
			const raw = element.style["font-family"];
			if (!raw) continue;
			const first = raw
				.split(",")[0]
				.trim()
				.replace(/^["']|["']$/g, "")
				.toLowerCase();
			if (!first || spec.fontFamilies.includes(first)) continue;
			found.push(
				finding(typeFamily, snapshot, element, {
					prop: "font-family",
					actual: first,
					expected: spec.fontFamilies.join(", "),
					message: `font-family "${first}" is not in the system`,
				}),
			);
		}
		return found;
	},
};

export const colorPalette: Rule = {
	id: "color/palette-conformance",
	severity: "warning",
	about: "colours come from the palette",
	check({ snapshot, spec, config }) {
		const found: Violation[] = [];
		if (spec.palette.length === 0) return found;
		const judge = (
			element: (typeof snapshot.elements)[number],
			prop: string,
		): void => {
			const value = rgba(element.style[prop]);
			// A fully transparent background is not a colour choice, and a
			// translucent one is composited against whatever is behind it — its
			// own channels say nothing about what the user saw.
			if (!value || value.a < 1) return;
			let best = { token: "", distance: Number.POSITIVE_INFINITY };
			for (const entry of spec.palette) {
				const distance = colorDistance(value, {
					r: entry.rgb[0],
					g: entry.rgb[1],
					b: entry.rgb[2],
				});
				if (distance < best.distance) best = { token: entry.token, distance };
			}
			if (best.distance <= config.colorTolerance) return;
			found.push(
				finding(colorPalette, snapshot, element, {
					prop,
					actual: `rgb(${value.r}, ${value.g}, ${value.b})`,
					expected: `palette colour (nearest ${best.token})`,
					message: `${prop} rgb(${value.r}, ${value.g}, ${value.b}) is off-palette, nearest is ${best.token}`,
				}),
			);
		};
		for (const element of snapshot.elements) {
			if (element.text) judge(element, "color");
			judge(element, "background-color");
		}
		return found;
	},
};

export const TOKEN_RULES: Rule[] = [
	spacingGrid,
	spacingScale,
	radiusScale,
	typeScale,
	typeWeight,
	typeFamily,
	colorPalette,
];
