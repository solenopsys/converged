import {
	DEFAULT_LOCALE,
	extractLocaleFromPath,
	isSupportedLocale,
	type SupportedLocale,
} from "./i18n";

export type LocaleRoutingMode = "multi" | "single";

export interface LocaleRoutingConfig {
	mode: LocaleRoutingMode;
	locale: SupportedLocale;
}

export function readInitialLocaleRouting(): LocaleRoutingConfig {
	if (typeof document === "undefined") {
		return { mode: "multi", locale: DEFAULT_LOCALE };
	}
	const el = document.getElementById("__INITIAL_DATA__");
	if (!el?.textContent) return { mode: "multi", locale: DEFAULT_LOCALE };
	try {
		const parsed = JSON.parse(el.textContent) as {
			localization?: { mode?: unknown; locale?: unknown };
		};
		const raw = parsed?.localization;
		const localeRaw =
			typeof raw?.locale === "string" ? raw.locale : undefined;
		const locale = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
		return {
			mode: raw?.mode === "single" ? "single" : "multi",
			locale,
		};
	} catch {
		return { mode: "multi", locale: DEFAULT_LOCALE };
	}
}

export function resolveRuntimeLocale(pathname?: string): SupportedLocale {
	const routing = readInitialLocaleRouting();
	if (routing.mode === "single") return routing.locale;
	const path =
		pathname ??
		(typeof window !== "undefined" ? window.location.pathname : "/");
	return extractLocaleFromPath(path) ?? DEFAULT_LOCALE;
}

export function stripRuntimeLocalePrefix(pathname: string): string {
	const locale = extractLocaleFromPath(pathname);
	if (!locale) return pathname || "/";
	const rest = pathname.slice(locale.length + 1);
	return rest.length > 0 ? rest : "/";
}
