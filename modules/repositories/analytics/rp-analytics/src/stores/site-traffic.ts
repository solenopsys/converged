import { sql } from "back-core";

const consolePaths = ["", "en", "ru", "de", "fr", "es", "it", "pt"].map(
	(locale) => `${locale ? `/${locale}` : ""}/console`,
);

export function isSiteUrl(url: string): boolean {
	return !consolePaths.some(
		(path) => url === path || ["/", "?", "#"].some((delimiter) => url.startsWith(`${path}${delimiter}`)),
	);
}

// Apply at read time as well so historic console activity stops distorting the
// site dashboard. Raw event/session lists remain available for inspection.
export function siteTrafficCondition() {
	return sql<boolean>`NOT (${sql.join(consolePaths.flatMap((path) => [
		sql`url = ${path}`,
		...["/", "?", "#"].map((delimiter) => sql`url LIKE ${`${path}${delimiter}%`}`),
	]), sql` OR `)})`;
}
