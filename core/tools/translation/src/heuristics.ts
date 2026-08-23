/**
 * Deciding which strings a human was ever supposed to translate.
 *
 * The unchanged-text check compares a target string against its source, and
 * without filtering it fires on everything a translator correctly left alone:
 * ids, icon names, URLs, file paths, CSS classes, numbers. These heuristics are
 * the filter. They are deliberately conservative — a false "technical" hides a
 * real miss, so the lists name concrete keys rather than guessing by shape.
 */

import { pathMatchesPrefix } from "./fs";
import type { ValidationConfig } from "./types";

/** Keys whose values are machine-facing wherever they appear. */
const TECHNICAL_KEYS = new Set([
	"id",
	"type",
	"icon",
	"markdown",
	"src",
	"url",
	"href",
	"logo",
	"logoPrefix",
	"darkLogoPrefix",
	"className",
	"lang",
	"locale",
	"from",
	"to",
	"fromAnchor",
	"toAnchor",
	"fromOffset",
	"toOffset",
	"x",
	"y",
	"w",
	"h",
	"width",
	"height",
	"duration",
	"stagger",
	"thickness",
	"color",
	"colorDark",
	"colorLight",
	"rect",
	"kind",
	"event",
	"bidirectional",
	"reverse",
	"tone",
	"value",
	"name",
]);

/**
 * Keys whose values are worth checking even when short. "Home" or "Next" are
 * below any sensible length threshold and are exactly what gets forgotten.
 */
const SHORT_TRANSLATABLE_KEYS = new Set([
	"button",
	"caption",
	"description",
	"empty",
	"eyebrow",
	"heading",
	"imageAlt",
	"intro",
	"label",
	"menuLinks",
	"nav",
	"navLabel",
	"note",
	"placeholder",
	"rows",
	"subtitle",
	"text",
	"think",
	"title",
]);

export function normalizeText(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

/** The `offset`-th segment from the end of a path, unescaped. */
export function pathKey(path: string, offset = 1): string {
	const segments = path.split("/").filter(Boolean);
	const key = segments.at(-offset);
	return key?.replaceAll("~1", "/").replaceAll("~0", "~") ?? "";
}

/**
 * Whether text is written in the script a locale expects. Used to spare
 * loanwords: a Russian page may legitimately keep "Bambu Lab" verbatim.
 */
export function matchesScript(
	value: string,
	script: "cyrillic" | "latin",
): boolean {
	const cyrillic = (value.match(/[А-Яа-яЁё]/g) ?? []).length;
	const latin = (value.match(/[A-Za-z]/g) ?? []).length;
	return script === "cyrillic" ? cyrillic > latin : latin > cyrillic;
}

export function isTechnicalString(
	path: string,
	value: string,
	ignoredPaths: string[] = [],
): boolean {
	if (ignoredPaths.some((prefix) => pathMatchesPrefix(path, prefix))) {
		return true;
	}

	const text = value.trim();
	return (
		TECHNICAL_KEYS.has(pathKey(path)) ||
		text.length === 0 ||
		/^\/?(?:https?:\/\/|mailto:)/i.test(text) ||
		/^\/?(?:images?|assets?|static|data)\//i.test(text) ||
		/^streamline:/i.test(text) ||
		/^[\w./-]+\.(?:json|svg|mp4|png|jpe?g|webp|gif|css|js|tsx?)$/i.test(text) ||
		/^[A-Z0-9._-]{2,}$/.test(text) ||
		/^[#.%\d\s()+\-–—]+$/.test(text)
	);
}

export function isShortTranslatableString(
	path: string,
	validation: ValidationConfig = {},
): boolean {
	const configured = validation.shortUnchangedStringKeys ?? [];
	const key = pathKey(path);
	return (
		configured.includes(key) ||
		SHORT_TRANSLATABLE_KEYS.has(key) ||
		// One level up catches list items: `/nav/0` is a nav label.
		SHORT_TRANSLATABLE_KEYS.has(pathKey(path, 2))
	);
}

/**
 * Whether a source/target pair should count as "not translated". Shared by the
 * JSON and markdown comparisons so both apply the same rules.
 */
export function isUntranslated(
	path: string,
	source: string,
	target: string,
	validation: ValidationConfig = {},
	targetLocale?: string,
): boolean {
	const minLength = validation.minUnchangedStringLength ?? 24;
	const longEnough =
		source.trim().length >= minLength ||
		isShortTranslatableString(path, validation);
	if (!longEnough) return false;
	if (normalizeText(source) !== normalizeText(target)) return false;

	const expectedScript = targetLocale
		? validation.sameTextScriptByLocale?.[targetLocale]
		: undefined;
	if (expectedScript && matchesScript(source, expectedScript)) return false;

	return !isTechnicalString(path, source, validation.ignoreStringPaths ?? []);
}
