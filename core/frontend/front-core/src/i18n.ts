import { useCallback, useEffect, useState } from "preact/hooks";
import { useUnit } from "effector-preact";
import { createEvent, createStore } from "effector";
import {
	DEFAULT_LOCALE,
	extractLocaleFromPath,
	isSupportedLocale,
	SUPPORTED_LOCALES,
	type SupportedLocale,
} from "./landing/i18n";







const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES as readonly string[]);

export const localeSetRequested = createEvent<SupportedLocale>();
export const localePathHydrated = createEvent<string>();

export const $activeLocale = createStore<SupportedLocale>(DEFAULT_LOCALE)
	.on(localeSetRequested, (_, locale) => locale)
	.on(localePathHydrated, (_, pathname) => extractLocaleFromPath(pathname) ?? DEFAULT_LOCALE);

function normalizeLocale(value: unknown): SupportedLocale | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (!supportedLocaleSet.has(normalized)) return null;
	return isSupportedLocale(normalized) ? normalized : null;
}

export class LocaleController {
	private static instance: LocaleController | null = null;
	private locales: Record<string, Record<string, string>> = {};

	constructor() {
		if (LocaleController.instance) return LocaleController.instance;
		LocaleController.instance = this;
	}

	static getInstance(): LocaleController {
		if (!LocaleController.instance) {
			new LocaleController();
		}
		return LocaleController.instance!;
	}

	getActiveLocale(): SupportedLocale {
		return $activeLocale.getState();
	}

	setLocale(nextLocale: string): SupportedLocale | null {
		const locale = normalizeLocale(nextLocale);
		if (!locale) return null;
		if ($activeLocale.getState() !== locale) {
			localeSetRequested(locale);
		}
		return locale;
	}

	hydrateFromPath(pathname: string): SupportedLocale {
		const locale = extractLocaleFromPath(pathname) ?? DEFAULT_LOCALE;
		this.setLocale(locale);
		return $activeLocale.getState();
	}

	setLocales(microfrontendId: string, locales: Record<string, string>): void {
		this.locales[microfrontendId] = locales;
	}

	getLocales(microfrontendId: string): Record<string, string> | undefined {
		return this.locales[microfrontendId];
	}
}

// namespace::locale → parsed JSON. Shared across every hook instance so a
// microfrontend's messages are fetched once per language, not once per view.
const translationsCache = new Map<string, unknown>();

function cacheKey(microfrontendId: string, language: string): string {
	return `${microfrontendId}::${language}`;
}

export function useMicrofrontendTranslation(microfrontendId: string): {
	t: (key: string) => unknown;
	translations: unknown;
	loading: boolean;
	locale: string;
} {
	const currentLanguage = useUnit($activeLocale);
	const key = cacheKey(microfrontendId, currentLanguage);

	const [translations, setTranslations] = useState<unknown>(() => translationsCache.get(key) ?? {});
	const [loading, setLoading] = useState(!translationsCache.has(key));

	useEffect(() => {
		if (translationsCache.has(key)) {
			setTranslations(translationsCache.get(key));
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);

		(async () => {
			try {
				const locales = LocaleController.getInstance().getLocales(microfrontendId) ?? {};
				const shortLanguage = currentLanguage.split("-")[0];
				const localeUrl =
					locales[currentLanguage] ??
					locales[currentLanguage.toLowerCase()] ??
					locales[shortLanguage] ??
					locales[DEFAULT_LOCALE] ??
					Object.values(locales)[0];

				if (!localeUrl) {
					translationsCache.set(key, {});
					if (!cancelled) setTranslations({});
					return;
				}

				const response = await fetch(localeUrl);
				if (!response.ok) {
					throw new Error(`Locale load failed: ${response.status} ${response.statusText}`);
				}

				const data = await response.json();
				const result = data && typeof data === "object" ? data : {};
				translationsCache.set(key, result);
				if (!cancelled) setTranslations(result);
			} catch (error) {
				console.error(`[i18n] Failed to load translations for ${microfrontendId}`, error);
				translationsCache.set(key, {});
				if (!cancelled) setTranslations({});
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [key, microfrontendId, currentLanguage]);

	const t = useCallback(
		(key: string): unknown => {
			if (!key) return translations;

			// 1) nested format: { places: { stats: { title: "..." } } }
			const segments = key.split(".");
			let nestedValue: unknown = translations;
			for (const segment of segments) {
				if (nestedValue && typeof nestedValue === "object" && segment in nestedValue) {
					nestedValue = (nestedValue as Record<string, unknown>)[segment];
				} else {
					nestedValue = undefined;
					break;
				}
			}
			if (nestedValue !== undefined) return nestedValue;

			// 2) flat format: { "places.stats.title": "..." }
			if (translations && typeof translations === "object" && key in translations) {
				return (translations as Record<string, unknown>)[key];
			}

			return key;
		},
		[translations],
	);

	return { t, translations, loading, locale: currentLanguage };
}
