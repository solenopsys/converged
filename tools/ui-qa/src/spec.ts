/**
 * The design system, read out of the running document instead of a config file.
 *
 * `front-core/src/styles/tokens.css` already states the whole system as data:
 * `--hw-unit: 4px` and everything else as `calc(var(--hw-unit) * N)`. Restating
 * those numbers in a linter config would create a second source of truth that
 * drifts the first time somebody edits the CSS, so the spec is probed instead.
 *
 * Probing is needed because a custom property's computed value is a token
 * sequence, not a number: `getPropertyValue("--hw-space-3")` answers
 * `calc(4px * 3)`. Assigning it to a real property and reading that property
 * back makes the engine do the arithmetic — `width: var(--hw-space-3)` computes
 * to `12px`. Each family of tokens needs a property that accepts its kind of
 * value, which is what `probeSpec` does below.
 *
 * Runs in the page (serialized by `page.evaluate`), so it closes over nothing.
 */

export type Rgb = [number, number, number];

export type PaletteEntry = { token: string; rgb: Rgb };

export type DesignSpec = {
	/** The grid every spacing value is expected to land on. */
	baseUnit: number;
	spacing: number[];
	radius: number[];
	fontSizes: number[];
	fontWeights: number[];
	/** First family of each font token, lowercased. */
	fontFamilies: string[];
	palette: PaletteEntry[];
	shadows: string[];
	/** Lengths that exist but are not a spacing scale — panel widths and such. */
	lengths: Record<string, number>;
	/** Raw token text, for reports and debugging. */
	tokens: Record<string, string>;
};

export type ProbeOptions = {
	/** Token name prefixes to read, e.g. `["--hw-", "--landing-"]`. */
	prefixes: string[];
	/** Token whose value is the spacing grid. */
	unitToken: string;
};

export const PROBE_DEFAULTS: ProbeOptions = {
	prefixes: ["--hw-", "--landing-", "--sf-"],
	unitToken: "--hw-unit",
};

/**
 * Collect every declared token and resolve it to a usable value.
 *
 * Token names come from two sources because neither one alone is enough.
 * Typed OM (`computedStyleMap`) enumerates the custom properties in effect on
 * the root and works no matter where the CSS came from. The stylesheet scan
 * adds names declared somewhere other than the root — but `cssRules` throws on
 * any sheet the page is not allowed to read, which includes every `<link>` on
 * a `file://` page, so it cannot be the only source.
 */
export function probeSpec(options: ProbeOptions): DesignSpec {
	const names = new Set<string>();
	const wanted = (name: string): boolean =>
		options.prefixes.some((prefix) => name.startsWith(prefix));

	const typed = (
		document.documentElement as Element & {
			computedStyleMap?: () => { keys(): Iterable<string> };
		}
	).computedStyleMap?.();
	if (typed) {
		for (const name of Array.from(typed.keys())) {
			if (name.startsWith("--") && wanted(name)) names.add(name);
		}
	}

	const pattern = /--[a-z0-9-]+/gi;
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue; // a sheet this page may not read
		}
		for (const rule of Array.from(rules)) {
			const text = rule.cssText;
			if (!text.includes("--")) continue;
			for (const match of text.match(pattern) ?? []) {
				if (wanted(match)) names.add(match);
			}
		}
	}

	// A sentinel-coloured host: an invalid substitution makes the property
	// invalid at computed-value time, which falls back to inherit for `color`
	// and to `auto`/`normal` for the rest. Comparing against the sentinel is
	// how a colour token is told apart from a length token.
	const sentinel = "rgb(1, 2, 3)";
	const host = document.createElement("div");
	host.style.cssText = `position:absolute;left:-9999px;top:0;width:0;height:0;color:${sentinel};font:16px/1 serif;contain:strict;`;
	const probe = document.createElement("div");
	probe.style.cssText = "position:absolute;left:0;top:0;";
	host.appendChild(probe);
	document.body.appendChild(host);

	const root = getComputedStyle(document.documentElement);
	const spec: DesignSpec = {
		baseUnit: 4,
		spacing: [],
		radius: [],
		fontSizes: [],
		fontWeights: [],
		fontFamilies: [],
		palette: [],
		shadows: [],
		lengths: {},
		tokens: {},
	};

	const asLength = (name: string): number | null => {
		probe.style.removeProperty("width");
		probe.style.setProperty("width", `var(${name})`);
		const value = Number.parseFloat(getComputedStyle(probe).width);
		probe.style.removeProperty("width");
		return Number.isFinite(value) ? value : null;
	};
	const asNumber = (name: string): number | null => {
		probe.style.removeProperty("z-index");
		probe.style.setProperty("z-index", `var(${name})`);
		const raw = getComputedStyle(probe).zIndex;
		probe.style.removeProperty("z-index");
		const value = Number.parseFloat(raw);
		return Number.isFinite(value) ? value : null;
	};
	const asColor = (name: string): string | null => {
		probe.style.removeProperty("color");
		probe.style.setProperty("color", `var(${name})`);
		const raw = getComputedStyle(probe).color;
		probe.style.removeProperty("color");
		return raw === sentinel ? null : raw;
	};
	const asShadow = (name: string): string | null => {
		probe.style.removeProperty("box-shadow");
		probe.style.setProperty("box-shadow", `var(${name})`);
		const raw = getComputedStyle(probe).boxShadow;
		probe.style.removeProperty("box-shadow");
		return raw && raw !== "none" ? raw : null;
	};
	const asFamily = (name: string): string | null => {
		probe.style.removeProperty("font-family");
		probe.style.setProperty("font-family", `var(${name})`);
		const raw = getComputedStyle(probe).fontFamily;
		probe.style.removeProperty("font-family");
		return raw && raw !== "serif" ? raw : null;
	};

	const push = (list: number[], value: number | null): void => {
		if (value === null) return;
		if (!list.includes(value)) list.push(value);
	};

	for (const name of Array.from(names).sort()) {
		const raw = root.getPropertyValue(name).trim();
		if (!raw) continue;
		spec.tokens[name] = raw;

		// Buckets go by name, not by what the value happens to parse as: a
		// colour that resolves as a length would otherwise widen the spacing
		// scale and silently accept anything.
		if (name === options.unitToken) {
			const unit = asLength(name);
			if (unit) spec.baseUnit = unit;
			push(spec.spacing, unit);
			continue;
		}
		if (name.includes("-space-") || name.includes("-gap")) {
			push(spec.spacing, asLength(name));
			continue;
		}
		if (name.includes("-radius")) {
			push(spec.radius, asLength(name));
			continue;
		}
		if (name.includes("-text-") || name.includes("-font-size")) {
			push(spec.fontSizes, asLength(name));
			continue;
		}
		if (name.includes("-weight")) {
			push(spec.fontWeights, asNumber(name));
			continue;
		}
		if (name.includes("-font")) {
			const family = asFamily(name);
			const first = family
				?.split(",")[0]
				?.trim()
				.replace(/^["']|["']$/g, "");
			if (first && !spec.fontFamilies.includes(first.toLowerCase())) {
				spec.fontFamilies.push(first.toLowerCase());
			}
			continue;
		}
		if (name.includes("-shadow")) {
			const shadow = asShadow(name);
			if (shadow && !spec.shadows.includes(shadow)) spec.shadows.push(shadow);
			continue;
		}
		const color = asColor(name);
		if (color) {
			const rgb = color.match(/[\d.]+/g);
			if (rgb && rgb.length >= 3) {
				spec.palette.push({
					token: name,
					rgb: [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])],
				});
			}
			continue;
		}
		const length = asLength(name);
		if (length !== null) spec.lengths[name] = length;
	}

	host.remove();
	spec.spacing.sort((a, b) => a - b);
	spec.radius.sort((a, b) => a - b);
	spec.fontSizes.sort((a, b) => a - b);
	spec.fontWeights.sort((a, b) => a - b);
	return spec;
}
