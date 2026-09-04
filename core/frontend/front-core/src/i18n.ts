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

export type SurfaceMessages = Record<string, unknown>;
export type SurfaceLocaleSource = string | SurfaceMessages;
export type SurfaceLocales = Record<string, SurfaceLocaleSource>;

const localeCatalogRegistered = createEvent<string>();
const $localeCatalogRevision = createStore<Record<string, number>>({}).on(
	localeCatalogRegistered,
	(revisions, surfaceId) => ({
		...revisions,
		[surfaceId]: (revisions[surfaceId] ?? 0) + 1,
	}),
);

// namespace::locale -> parsed JSON. Shared across every hook instance so a
// surface's messages are resolved once per language, not once per view.
const translationsCache = new Map<string, SurfaceMessages>();

function cacheKey(surfaceId: string, language: string): string {
	return `${surfaceId}::${language}`;
}

function invalidateTranslations(surfaceId: string): void {
	const prefix = `${surfaceId}::`;
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
	private locales: Record<string, SurfaceLocales> = {};

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

	setLocales(surfaceId: string, locales: SurfaceLocales): void {
		this.locales[surfaceId] = {
			...this.locales[surfaceId],
			...locales,
		};
		invalidateTranslations(surfaceId);
		localeCatalogRegistered(surfaceId);
	}

	getLocales(surfaceId: string): SurfaceLocales | undefined {
		return this.locales[surfaceId];
	}

	resetForTests(): void {
		this.locales = {};
	}
}

export function registerSurfaceLocales(
	surfaceId: string,
	locales: Record<string, SurfaceMessages>,
): void {
	LocaleController.getInstance().setLocales(surfaceId, locales);
}

function isMessages(value: unknown): value is SurfaceMessages {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localeSource(
	surfaceId: string,
	language: string,
): SurfaceLocaleSource | undefined {
	const locales =
		LocaleController.getInstance().getLocales(surfaceId) ?? {};
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

export async function loadSurfaceTranslations(
	surfaceId: string,
	language: string,
): Promise<SurfaceMessages> {
	const source = localeSource(surfaceId, language);
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

/**
 * Resolves a value from an already embedded surface catalog. Action
 * metadata uses this outside Preact, so it cannot rely on the translation hook.
 * Remote locale URLs deliberately do not trigger a request here: catalog reads
 * must stay synchronous and side-effect free.
 */
export function resolveEmbeddedSurfaceMessage(
	surfaceId: string,
	key: string,
	language = $activeLocale.getState(),
): unknown {
	const source = localeSource(surfaceId, language);
	if (!isMessages(source)) return undefined;

	let value: unknown = source;
	for (const segment of key.split(".")) {
		if (!value || typeof value !== "object" || !(segment in value)) {
			return (source as Record<string, unknown>)[key];
		}
		value = (value as Record<string, unknown>)[segment];
	}
	return value;
}

export function resetSurfaceI18nForTests(): void {
	LocaleController.getInstance().resetForTests();
	translationsCache.clear();
}

export function useSurfaceTranslation(surfaceId: string): {
	t: (key: string) => unknown;
	translations: unknown;
	loading: boolean;
	locale: string;
} {
	const currentLanguage = useUnit($activeLocale);
	const catalogRevisions = useUnit($localeCatalogRevision);
	const catalogRevision = catalogRevisions[surfaceId] ?? 0;
	const key = cacheKey(surfaceId, currentLanguage);
	const embedded = localeSource(surfaceId, currentLanguage);
	const embeddedTranslations = isMessages(embedded) ? embedded : undefined;

	const [loaded, setLoaded] = useState<{
		key: string;
		translations: SurfaceMessages;
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

		void loadSurfaceTranslations(surfaceId, currentLanguage)
			.then((result) => {
				translationsCache.set(key, result);
				if (!cancelled) setLoaded({ key, translations: result });
			})
			.catch((error) => {
				console.error(
					`[i18n] Failed to load translations for ${surfaceId}`,
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
	}, [key, surfaceId, currentLanguage, catalogRevision]);

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
