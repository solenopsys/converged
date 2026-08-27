import { createEvent, createStore } from "effector";
import { useUnit } from "effector-preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import {
	DEFAULT_LOCALE,
	extractLocaleFromPath,
	isSupportedLocale,
	SUPPORTED_LOCALES,
	type SupportedLocale,
} from "./landing/i18n";

const supportedLocaleSet = new Set<string>(
	SUPPORTED_LOCALES as readonly string[],
);

export const localeSetRequested = createEvent<SupportedLocale>();
export const localePathHydrated = createEvent<string>();

export const $activeLocale = createStore<SupportedLocale>(DEFAULT_LOCALE)
	.on(localeSetRequested, (_, locale) => locale)
	.on(
		localePathHydrated,
		(_, pathname) => extractLocaleFromPath(pathname) ?? DEFAULT_LOCALE,
	);

export type MicrofrontendMessages = Record<string, unknown>;
export type MicrofrontendLocaleSource = string | MicrofrontendMessages;
export type MicrofrontendLocales = Record<string, MicrofrontendLocaleSource>;

const localeCatalogRegistered = createEvent<string>();
const $localeCatalogRevision = createStore<Record<string, number>>({}).on(
	localeCatalogRegistered,
	(revisions, microfrontendId) => ({
		...revisions,
		[microfrontendId]: (revisions[microfrontendId] ?? 0) + 1,
	}),
);

// namespace::locale -> parsed JSON. Shared across every hook instance so a
// microfrontend's messages are resolved once per language, not once per view.
const translationsCache = new Map<string, MicrofrontendMessages>();

function cacheKey(microfrontendId: string, language: string): string {
	return `${microfrontendId}::${language}`;
}

function invalidateTranslations(microfrontendId: string): void {
	const prefix = `${microfrontendId}::`;
	for (const key of translationsCache.keys()) {
		if (key.startsWith(prefix)) translationsCache.delete(key);
	}
}

function normalizeLocale(value: unknown): SupportedLocale | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (!supportedLocaleSet.has(normalized)) return null;
	return isSupportedLocale(normalized) ? normalized : null;
}

export class LocaleController {
	private static instance: LocaleController | null = null;
	private locales: Record<string, MicrofrontendLocales> = {};

	private constructor() {}

	static getInstance(): LocaleController {
		if (!LocaleController.instance) {
			LocaleController.instance = new LocaleController();
		}
		return LocaleController.instance;
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

	setLocales(microfrontendId: string, locales: MicrofrontendLocales): void {
		this.locales[microfrontendId] = {
			...this.locales[microfrontendId],
			...locales,
		};
		invalidateTranslations(microfrontendId);
		localeCatalogRegistered(microfrontendId);
	}

	getLocales(microfrontendId: string): MicrofrontendLocales | undefined {
		return this.locales[microfrontendId];
	}

	resetForTests(): void {
		this.locales = {};
	}
}

export function registerMicrofrontendLocales(
	microfrontendId: string,
	locales: Record<string, MicrofrontendMessages>,
): void {
	LocaleController.getInstance().setLocales(microfrontendId, locales);
}

function isMessages(value: unknown): value is MicrofrontendMessages {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localeSource(
	microfrontendId: string,
	language: string,
): MicrofrontendLocaleSource | undefined {
	const locales =
		LocaleController.getInstance().getLocales(microfrontendId) ?? {};
	const normalized = language.toLowerCase();
	const shortLanguage = normalized.split("-")[0];
	return (
		locales[language] ??
		locales[normalized] ??
		locales[shortLanguage] ??
		locales[DEFAULT_LOCALE] ??
		Object.values(locales)[0]
	);
}

export async function loadMicrofrontendTranslations(
	microfrontendId: string,
	language: string,
): Promise<MicrofrontendMessages> {
	const source = localeSource(microfrontendId, language);
	if (isMessages(source)) return source;
	if (!source) return {};

	const response = await fetch(source);
	if (!response.ok) {
		throw new Error(
			`Locale load failed: ${response.status} ${response.statusText}`,
		);
	}
	const data: unknown = await response.json();
	return isMessages(data) ? data : {};
}

export function resetMicrofrontendI18nForTests(): void {
	LocaleController.getInstance().resetForTests();
	translationsCache.clear();
}

export function useMicrofrontendTranslation(microfrontendId: string): {
	t: (key: string) => unknown;
	translations: unknown;
	loading: boolean;
	locale: string;
} {
	const currentLanguage = useUnit($activeLocale);
	const catalogRevisions = useUnit($localeCatalogRevision);
	const catalogRevision = catalogRevisions[microfrontendId] ?? 0;
	const key = cacheKey(microfrontendId, currentLanguage);
	const embedded = localeSource(microfrontendId, currentLanguage);
	const embeddedTranslations = isMessages(embedded) ? embedded : undefined;

	const [loaded, setLoaded] = useState<{
		key: string;
		translations: MicrofrontendMessages;
	}>(() => ({
		key,
		translations: embeddedTranslations ?? translationsCache.get(key) ?? {},
	}));
	const translations =
		embeddedTranslations ??
		(loaded.key === key
			? loaded.translations
			: (translationsCache.get(key) ?? {}));
	const [loading, setLoading] = useState(
		!embeddedTranslations && !translationsCache.has(key),
	);

	useEffect(() => {
		if (embeddedTranslations) {
			translationsCache.set(key, embeddedTranslations);
			setLoaded({ key, translations: embeddedTranslations });
			setLoading(false);
			return;
		}

		const cachedTranslations = translationsCache.get(key);
		if (cachedTranslations) {
			setLoaded({ key, translations: cachedTranslations });
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);

		void loadMicrofrontendTranslations(microfrontendId, currentLanguage)
			.then((result) => {
				translationsCache.set(key, result);
				if (!cancelled) setLoaded({ key, translations: result });
			})
			.catch((error) => {
				console.error(
					`[i18n] Failed to load translations for ${microfrontendId}`,
					error,
				);
				if (!cancelled) setLoaded({ key, translations: {} });
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [key, microfrontendId, currentLanguage, catalogRevision]);

	const t = useCallback(
		(key: string): unknown => {
			if (!key) return translations;

			// 1) nested format: { places: { stats: { title: "..." } } }
			const segments = key.split(".");
			let nestedValue: unknown = translations;
			for (const segment of segments) {
				if (
					nestedValue &&
					typeof nestedValue === "object" &&
					segment in nestedValue
				) {
					nestedValue = (nestedValue as Record<string, unknown>)[segment];
				} else {
					nestedValue = undefined;
					break;
				}
			}
			if (nestedValue !== undefined) return nestedValue;

			// 2) flat format: { "places.stats.title": "..." }
			if (
				translations &&
				typeof translations === "object" &&
				key in translations
			) {
				return (translations as Record<string, unknown>)[key];
			}

			return key;
		},
		[translations],
	);

	return { t, translations, loading, locale: currentLanguage };
}
