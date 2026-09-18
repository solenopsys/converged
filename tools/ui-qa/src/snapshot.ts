/**
 * The rendered interface as data — not a screenshot.
 *
 * Everything a rule needs is taken from the browser: geometry from
 * `getBoundingClientRect`, style from `getComputedStyle`, structure from the
 * tree itself. Nothing is inferred from pixels, so the same page always yields
 * the same snapshot and a rule can never be "almost sure".
 *
 * Scope is the part that decides whether this tool is usable at all. A whole
 * console page holds tens of thousands of elements, most of them inside
 * third-party widgets — maps, charts, model viewers — whose paddings are not
 * ours to lint. Reporting them is how a tool like this earns its first hundred
 * false positives and gets switched off. So the walk only enters our own
 * components, which the codebase already marks: `data-slot` is on 50 call sites
 * in `front-core`, with `data-variant` / `data-size` / `data-kind` beside it.
 * That same attribute is what makes cross-projection comparison possible later.
 *
 * Runs in the page (serialized by `page.evaluate`), so it closes over nothing
 * and takes every parameter as an argument.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type UiElement = {
	id: number;
	parent: number | null;
	tag: string;
	/** `data-slot`: the component this element belongs to. */
	slot: string | null;
	/** `data-variant` / `data-size` / `data-kind`, joined. */
	variant: string | null;
	/** Slot chain + tag + ordinal. Stable between runs, unlike a CSS path. */
	path: string;
	selector: string;
	role: string | null;
	name: string | null;
	box: Box;
	scroll: {
		scrollW: number;
		clientW: number;
		scrollH: number;
		clientH: number;
	};
	style: Record<string, string>;
	/** Holds text of its own, so typography rules apply to it. */
	text: boolean;
	interactive: boolean;
};

export type Viewport = {
	name: string;
	width: number;
	height: number;
	dpr: number;
};

export type UiSnapshot = {
	/** Logical name of what was rendered — a projection, a story step, a URL. */
	target: string;
	url: string;
	viewport: Viewport;
	elements: UiElement[];
	/** True when no `data-slot` was found and the whole body was scanned. */
	unscoped: boolean;
};

/** Computed properties worth carrying. Kept short: this is per element. */
export const CAPTURED_PROPS = [
	"display",
	"position",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"margin-top",
	"margin-right",
	"margin-bottom",
	"margin-left",
	"row-gap",
	"column-gap",
	"border-top-left-radius",
	"border-top-right-radius",
	"border-bottom-right-radius",
	"border-bottom-left-radius",
	"border-top-width",
	"border-bottom-width",
	"border-left-width",
	"border-right-width",
	"font-family",
	"font-size",
	"font-weight",
	"line-height",
	"letter-spacing",
	"color",
	"background-color",
	"box-shadow",
	"opacity",
	"z-index",
	"overflow-x",
	"overflow-y",
] as const;

/** Subtrees that are not ours to measure. */
export const VENDOR_SELECTORS = [
	"svg",
	"canvas",
	"model-viewer",
	"iframe",
	"video",
	"[data-qa-ignore]",
	".maplibregl-map",
	".mapboxgl-map",
];

export type ExtractOptions = {
	target: string;
	viewport: Viewport;
	props: readonly string[];
	vendorSelectors: string[];
	/** How deep to go inside one slot before stopping. */
	maxDepth: number;
	maxElements: number;
};

export function extractSnapshot(options: ExtractOptions): UiSnapshot {
	// Declared inside because this function is serialized into the page: a
	// reference to anything in the module scope would be undefined there.
	const interactiveTags = [
		"button",
		"a",
		"input",
		"select",
		"textarea",
		"summary",
		"label",
	];
	const interactiveRoles = [
		"button",
		"link",
		"tab",
		"menuitem",
		"menuitemcheckbox",
		"menuitemradio",
		"checkbox",
		"switch",
		"radio",
		"option",
		"slider",
		"combobox",
	];
	const elements: UiElement[] = [];
	const vendor = options.vendorSelectors.join(",");
	const unscoped = document.querySelector("[data-slot]") === null;

	const ownToken = (node: Element): string => {
		const slot = node.getAttribute("data-slot");
		const variant = [
			node.getAttribute("data-variant"),
			node.getAttribute("data-size"),
			node.getAttribute("data-kind"),
		]
			.filter(Boolean)
			.join(".");
		const base = slot ? `@${slot}` : node.tagName.toLowerCase();
		return variant ? `${base}[${variant}]` : base;
	};

	const visit = (
		node: Element,
		parent: number | null,
		parentPath: string,
		depth: number,
	): void => {
		if (elements.length >= options.maxElements) return;
		if (vendor && node.matches(vendor)) return;

		const slot = node.getAttribute("data-slot");
		const inSlot = slot !== null || depth > 0;
		const token = ownToken(node);

		// Siblings sharing a token are told apart by their order, so a path
		// stays the same when unrelated markup around them changes.
		let ordinal = 0;
		let sibling = node.previousElementSibling;
		while (sibling) {
			if (ownToken(sibling) === token) ordinal += 1;
			sibling = sibling.previousElementSibling;
		}
		const path = `${parentPath}/${token}${ordinal > 0 ? `:${ordinal}` : ""}`;

		let id: number | null = null;
		const rect = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		const visible =
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			(rect.width > 0 || rect.height > 0);

		if ((inSlot || unscoped) && visible) {
			const captured: Record<string, string> = {};
			for (const prop of options.props) {
				captured[prop] = style.getPropertyValue(prop);
			}
			const tag = node.tagName.toLowerCase();
			const role = node.getAttribute("role");
			const label =
				node.getAttribute("aria-label") ??
				node.getAttribute("title") ??
				(node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) ??
				null;
			const hasOwnText = Array.from(node.childNodes).some(
				(child) =>
					child.nodeType === 3 && (child.textContent ?? "").trim().length > 0,
			);
			const classes = (node.getAttribute("class") ?? "")
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 3);

			id = elements.length;
			elements.push({
				id,
				parent,
				tag,
				slot,
				variant:
					[
						node.getAttribute("data-variant"),
						node.getAttribute("data-size"),
						node.getAttribute("data-kind"),
					]
						.filter(Boolean)
						.join(".") || null,
				path,
				selector: `${tag}${slot ? `[data-slot="${slot}"]` : ""}${classes.map((name) => `.${name}`).join("")}`,
				role,
				name: label || null,
				box: {
					x: Math.round(rect.x * 100) / 100,
					y: Math.round(rect.y * 100) / 100,
					w: Math.round(rect.width * 100) / 100,
					h: Math.round(rect.height * 100) / 100,
				},
				scroll: {
					scrollW: node.scrollWidth,
					clientW: node.clientWidth,
					scrollH: node.scrollHeight,
					clientH: node.clientHeight,
				},
				style: captured,
				text: hasOwnText,
				interactive:
					interactiveTags.includes(tag) ||
					(role !== null && interactiveRoles.includes(role)) ||
					node.hasAttribute("onclick"),
			});
		}

		// Depth counts from the slot boundary: deep inside one component the
		// markup is implementation detail, and the noise it produces is not
		// worth the findings.
		const nextDepth = slot !== null ? 1 : inSlot ? depth + 1 : 0;
		if (inSlot && nextDepth > options.maxDepth) return;
		for (const child of Array.from(node.children)) {
			visit(child, id ?? parent, path, nextDepth);
		}
	};

	for (const child of Array.from(document.body.children)) {
		visit(child, null, "", 0);
	}

	return {
		target: options.target,
		url: location.href,
		viewport: options.viewport,
		elements,
		unscoped,
	};
}
