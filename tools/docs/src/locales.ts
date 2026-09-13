/**
 * What counts as a language directory.
 *
 * The stores keep one directory per locale, and the build writes `html`,
 * `pdf` and `readme` beside them for its own output formats. Those names are
 * lowercase and two-to-three letters, exactly like a language code, so a bare
 * shape test accepts them: `pdf` then travels through the pipeline as if it
 * were a language — listed as a target locale, seeded with English, sent to
 * the translator, indexed and published. It is not a language, and nothing
 * reads those directories; the PDF target renders from the books and writes
 * to `out.pdf`.
 *
 * One predicate, used everywhere a directory name is turned into a locale, so
 * the exclusion cannot be forgotten in one place and honoured in the rest.
 */
const OUTPUT_FORMATS = new Set(["html", "pdf", "readme"]);

export function isLocale(name: string): boolean {
	return /^[a-z]{2,3}$/.test(name) && !OUTPUT_FORMATS.has(name);
}
