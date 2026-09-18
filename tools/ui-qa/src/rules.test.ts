/**
 * The rules, tested without a browser.
 *
 * This is the point of keeping them pure: a snapshot is plain data, so every
 * rule can be held to a literal example and a finding can never depend on
 * timing, fonts or a running stack. A rule that cannot be tested like this is a
 * rule that is about to start flaking.
 */
import { describe, expect, test } from "bun:test";
import { compare } from "./baseline";
import { runCrossRules, runRules } from "./rules";
import { crossConsistency, siblingPadding } from "./rules/consistency";
import {
	horizontalOverflow,
	touchTarget,
	viewportOverflow,
} from "./rules/layout";
import {
	colorPalette,
	radiusScale,
	spacingGrid,
	spacingScale,
	typeFamily,
	typeScale,
	typeWeight,
} from "./rules/tokens";
import type { UiElement, UiSnapshot } from "./snapshot";
import type { DesignSpec } from "./spec";
import { DEFAULT_CONFIG, fingerprint, type Violation } from "./violation";

const SPEC: DesignSpec = {
	baseUnit: 4,
	spacing: [4, 8, 12, 16, 24],
	radius: [4, 6, 10, 9999],
	fontSizes: [12, 14, 16, 20],
	fontWeights: [400, 500, 600],
	fontFamilies: ["inter"],
	palette: [
		{ token: "--hw-ink", rgb: [23, 24, 22] },
		{ token: "--hw-accent", rgb: [191, 69, 69] },
		{ token: "--hw-canvas", rgb: [247, 247, 245] },
	],
	shadows: [],
	lengths: {},
	tokens: {},
};

const BASE_STYLE: Record<string, string> = {
	display: "block",
	position: "static",
	"padding-top": "0px",
	"padding-right": "0px",
	"padding-bottom": "0px",
	"padding-left": "0px",
	"margin-top": "0px",
	"margin-right": "0px",
	"margin-bottom": "0px",
	"margin-left": "0px",
	"row-gap": "normal",
	"column-gap": "normal",
	"border-top-left-radius": "0px",
	"border-top-right-radius": "0px",
	"border-bottom-right-radius": "0px",
	"border-bottom-left-radius": "0px",
	"font-family": "Inter, system-ui",
	"font-size": "16px",
	"font-weight": "400",
	color: "rgb(23, 24, 22)",
	"background-color": "rgba(0, 0, 0, 0)",
	"overflow-x": "visible",
	"overflow-y": "visible",
};

let nextId = 0;

function element(partial: Partial<UiElement> = {}): UiElement {
	const id = partial.id ?? nextId++;
	return {
		id,
		parent: null,
		tag: "div",
		slot: null,
		variant: null,
		path: `/div:${id}`,
		selector: "div",
		role: null,
		name: null,
		box: { x: 0, y: 0, w: 100, h: 40 },
		scroll: { scrollW: 100, clientW: 100, scrollH: 40, clientH: 40 },
		text: false,
		interactive: false,
		...partial,
		style: { ...BASE_STYLE, ...(partial.style ?? {}) },
	};
}

function snapshot(elements: UiElement[], over: Partial<UiSnapshot> = {}) {
	return {
		target: "demo",
		url: "about:blank",
		viewport: { name: "390px", width: 390, height: 844, dpr: 2 },
		elements,
		unscoped: false,
		...over,
	} satisfies UiSnapshot;
}

function check(
	rule: { check(context: never): Violation[] },
	snap: UiSnapshot,
): Violation[] {
	return (rule.check as (context: unknown) => Violation[])({
		snapshot: snap,
		spec: SPEC,
		config: DEFAULT_CONFIG,
	});
}

describe("spacing", () => {
	test("a hand-typed value off the base unit is a finding", () => {
		const found = check(
			spacingGrid,
			snapshot([element({ style: { "padding-top": "13px" } })]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].rule).toBe("spacing/grid-conformance");
		expect(found[0].message).toContain("13px");
	});

	test("values on the grid pass, including a half-unit", () => {
		const found = check(
			spacingGrid,
			snapshot([
				element({ style: { "padding-top": "12px", "margin-left": "24px" } }),
			]),
		);
		expect(found).toEqual([]);
	});

	test("subpixel rounding is not a finding", () => {
		const found = check(
			spacingGrid,
			snapshot([element({ style: { "padding-left": "11.75px" } })]),
		);
		expect(found).toEqual([]);
	});

	test("auto and percentage margins are skipped", () => {
		const found = check(
			spacingGrid,
			snapshot([
				element({ style: { "margin-left": "auto", "padding-top": "10%" } }),
			]),
		);
		expect(found).toEqual([]);
	});

	test("the stricter scale rule sees what the grid rule allows", () => {
		// 20px is a clean multiple of the unit and still not a spacing token.
		const off = snapshot([element({ style: { "padding-top": "20px" } })]);
		expect(check(spacingGrid, off)).toEqual([]);
		const found = check(spacingScale, off);
		expect(found).toHaveLength(1);
		expect(found[0].severity).toBe("info");
	});
});

describe("radius and type", () => {
	test("a radius outside the scale is a finding, zero is not", () => {
		const found = check(
			radiusScale,
			snapshot([
				element({ style: { "border-top-left-radius": "7px" } }),
				element({ style: { "border-top-left-radius": "0px" } }),
			]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].actual).toBe("7px");
	});

	test("typography is judged only where there is text", () => {
		const styled = { "font-size": "15px", "font-weight": "300" };
		expect(check(typeScale, snapshot([element({ style: styled })]))).toEqual(
			[],
		);
		expect(
			check(typeScale, snapshot([element({ text: true, style: styled })])),
		).toHaveLength(1);
		expect(
			check(typeWeight, snapshot([element({ text: true, style: styled })])),
		).toHaveLength(1);
	});

	test("an unapproved family is a finding, the system font is not", () => {
		expect(
			check(
				typeFamily,
				snapshot([
					element({ text: true, style: { "font-family": "Georgia, serif" } }),
				]),
			),
		).toHaveLength(1);
		expect(
			check(
				typeFamily,
				snapshot([
					element({
						text: true,
						style: { "font-family": '"Inter", system-ui' },
					}),
				]),
			),
		).toEqual([]);
	});
});

describe("colour", () => {
	test("an off-palette colour names its nearest token", () => {
		const found = check(
			colorPalette,
			snapshot([element({ text: true, style: { color: "rgb(208, 32, 32)" } })]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].expected).toContain("--hw-accent");
	});

	test("a colour within tolerance passes", () => {
		const found = check(
			colorPalette,
			snapshot([element({ text: true, style: { color: "rgb(191, 70, 70)" } })]),
		);
		expect(found).toEqual([]);
	});

	test("a translucent background says nothing about what was seen", () => {
		const found = check(
			colorPalette,
			snapshot([
				element({ style: { "background-color": "rgba(12, 200, 7, 0.4)" } }),
			]),
		);
		expect(found).toEqual([]);
	});
});

describe("layout", () => {
	test("clipped content is an error, a scroller is not", () => {
		const clipped = element({
			style: { "overflow-x": "hidden" },
			scroll: { scrollW: 260, clientW: 120, scrollH: 40, clientH: 40 },
		});
		const scroller = element({
			style: { "overflow-x": "auto" },
			scroll: { scrollW: 260, clientW: 120, scrollH: 40, clientH: 40 },
		});
		const spilling = element({
			style: { "overflow-x": "visible" },
			scroll: { scrollW: 260, clientW: 120, scrollH: 40, clientH: 40 },
		});
		const found = check(
			horizontalOverflow,
			snapshot([clipped, scroller, spilling]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].severity).toBe("error");
		expect(found[0].message).toContain("clipped");
	});

	test("one mistake in a shorthand is one finding, not four", () => {
		const found = check(
			spacingGrid,
			snapshot([
				element({
					style: {
						"padding-top": "13px",
						"padding-right": "13px",
						"padding-bottom": "13px",
						"padding-left": "13px",
					},
				}),
			]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].prop).toBe("padding");
	});

	test("differing bad sides stay separate", () => {
		const found = check(
			spacingGrid,
			snapshot([
				element({
					style: { "padding-top": "13px", "padding-left": "7px" },
				}),
			]),
		);
		expect(found.map((violation) => violation.prop).sort()).toEqual([
			"padding-left",
			"padding-top",
		]);
	});

	test("only the outermost element past the edge is reported", () => {
		const parent = element({
			id: 0,
			box: { x: 0, y: 0, w: 900, h: 100 },
		});
		const child = element({
			id: 1,
			parent: 0,
			box: { x: 0, y: 0, w: 800, h: 50 },
		});
		const found = check(viewportOverflow, snapshot([parent, child]));
		expect(found).toHaveLength(1);
		expect(found[0].path).toBe(parent.path);
	});

	test("a small interactive element is below the touch target", () => {
		const found = check(
			touchTarget,
			snapshot([
				element({
					interactive: true,
					name: "Add",
					box: { x: 0, y: 0, w: 18, h: 18 },
				}),
				element({ interactive: true, box: { x: 0, y: 0, w: 40, h: 40 } }),
			]),
		);
		expect(found).toHaveLength(1);
		expect(found[0].message).toContain('"Add"');
	});
});

describe("consistency", () => {
	test("the odd sibling of a group is reported, the majority is not", () => {
		const rows = [0, 1, 2].map((index) =>
			element({
				id: index + 10,
				parent: 1,
				slot: "row",
				path: `/list/@row:${index}`,
				style:
					index === 2
						? { "padding-top": "16px", "padding-bottom": "16px" }
						: { "padding-top": "8px", "padding-bottom": "8px" },
			}),
		);
		const found = check(siblingPadding, snapshot(rows));
		expect(found).toHaveLength(1);
		expect(found[0].path).toBe("/list/@row:2");
	});

	test("a group with no majority is not an inconsistency", () => {
		const rows = [8, 12, 16].map((padding, index) =>
			element({
				id: index + 20,
				parent: 2,
				slot: "row",
				style: { "padding-top": `${padding}px` },
			}),
		);
		expect(check(siblingPadding, snapshot(rows))).toEqual([]);
	});

	test("one component with three looks is a cross-projection finding", () => {
		const badge = (target: string, background: string) =>
			snapshot(
				[
					element({
						slot: "badge",
						path: "/panel/@badge",
						style: { "background-color": background },
					}),
				],
				{ target },
			);
		const found = crossConsistency.check(
			[
				badge("orders", "rgb(191, 69, 69)"),
				badge("orders", "rgb(191, 69, 69)"),
				badge("customers", "rgb(42, 120, 214)"),
				badge("reports", "rgb(31, 107, 46)"),
			],
			SPEC,
			DEFAULT_CONFIG,
		);
		expect(found).toHaveLength(2);
		expect(found[0].rule).toBe("slot/cross-consistency");
		expect(found[0].path).toBe("@badge");
		expect(found[0].message).toContain("3 looks");
	});

	test("a component that looks the same everywhere is silent", () => {
		const same = () =>
			snapshot([element({ slot: "badge", path: "/panel/@badge" })]);
		expect(
			crossConsistency.check([same(), same()], SPEC, DEFAULT_CONFIG),
		).toEqual([]);
	});
});

describe("the run as a whole", () => {
	test("config can silence a rule and accept a known difference", () => {
		const snap = snapshot([
			element({ slot: "card", style: { "padding-top": "13px" } }),
		]);
		// 13px breaks both spacing rules: it is off the grid and off the scale.
		expect(runRules(snap, SPEC, DEFAULT_CONFIG)).toHaveLength(2);
		expect(
			runRules(snap, SPEC, {
				...DEFAULT_CONFIG,
				rules: { "spacing/grid-conformance": { enabled: false } },
			}).map((violation) => violation.rule),
		).toEqual(["spacing/scale-conformance"]);
		expect(
			runRules(snap, SPEC, {
				...DEFAULT_CONFIG,
				accepted: [{ slot: "card", reason: "legacy card, scheduled" }],
			}),
		).toEqual([]);
	});

	test("severity can be raised from config", () => {
		const snap = snapshot([element({ style: { "padding-top": "13px" } })]);
		const found = runRules(snap, SPEC, {
			...DEFAULT_CONFIG,
			rules: { "spacing/grid-conformance": { severity: "error" } },
		});
		expect(found[0].severity).toBe("error");
	});

	test("cross rules see every snapshot at once", () => {
		const found = runCrossRules(
			[
				snapshot([element({ slot: "badge", path: "/@badge" })], {
					target: "a",
				}),
				snapshot(
					[
						element({
							slot: "badge",
							path: "/@badge",
							style: { "font-size": "20px" },
						}),
					],
					{ target: "b" },
				),
			],
			SPEC,
			DEFAULT_CONFIG,
		);
		expect(found).toHaveLength(1);
		expect(found[0].prop).toBe("font-size");
	});
});

describe("baseline", () => {
	const violation = (path: string): Violation => ({
		rule: "spacing/grid-conformance",
		severity: "warning",
		target: "demo",
		viewport: "390px",
		path,
		selector: "div",
		slot: null,
		prop: "padding-top",
		actual: "13px",
		expected: "multiple of 4px",
		message: "off grid",
	});

	test("known debt is separated from new debt, and repairs are noticed", () => {
		const old = violation("/a");
		const baseline = {
			written: "",
			entries: { [fingerprint(old)]: "off grid", "gone|x|y|z|w": "old" },
		};
		const result = compare([old, violation("/b")], baseline);
		expect(result.known.map((item) => item.path)).toEqual(["/a"]);
		expect(result.fresh.map((item) => item.path)).toEqual(["/b"]);
		expect(result.fixed).toEqual(["gone|x|y|z|w"]);
	});

	test("changing a wrong value does not create a new finding", () => {
		const before = violation("/a");
		const after = { ...before, actual: "15px", message: "still off grid" };
		const baseline = { written: "", entries: { [fingerprint(before)]: "x" } };
		expect(compare([after], baseline).fresh).toEqual([]);
	});

	test("without a baseline everything is new", () => {
		const result = compare([violation("/a")], null);
		expect(result.fresh).toHaveLength(1);
		expect(result.fixed).toEqual([]);
	});
});
