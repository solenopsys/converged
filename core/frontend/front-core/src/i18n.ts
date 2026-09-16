import { createEffect, createEvent, createStore, sample } from "effector";
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
		(_, pathname) =>
			extractLocaleFromPath(pathname) ?? storedLocale() ?? DEFAULT_LOCALE,
	);

// The language a person chose on this browser. The console's URL carries no
// locale, so without this every reload of a signed-in page falls back to the
// default. A signed-in user also gets it from the account (workspace-layouts).
const LOCALE_STORAGE_KEY = "front-core:locale";

function localeStorage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		// Storage access throws outright when the browser blocks it for the origin.
		return null;
	}
}

function storedLocale(): SupportedLocale | null {
	const value = localeStorage()?.getItem(LOCALE_STORAGE_KEY);
	return value && isSupportedLocale(value) ? value : null;
}

export const rememberLocaleFx = createEffect((locale: SupportedLocale) => {
	localeStorage()?.setItem(LOCALE_STORAGE_KEY, locale);
});

sample({ clock: $activeLocale.updates, target: rememberLocaleFx });

export type SurfaceMessages = Record<string, unknown>;
export type SurfaceLocaleSource = string | SurfaceMessages;
export type SurfaceLocales = Record<string, SurfaceLocaleSource>;

const localeCatalogRegistered = createEvent<string>();
/** Bumps per surface whenever its messages arrive; stores that render labels follow it. */
export const $localeCatalogRevision = createStore<Record<string, number>>({}).on(
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

	/** A locale in the path wins (landing pages); else what this browser chose. */
	hydrateFromPath(pathname: string): SupportedLocale {
		const locale =
			extractLocaleFromPath(pathname) ?? storedLocale() ?? DEFAULT_LOCALE;
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

/**
 * Registers only the locales a surface does not have yet. The object index
 * uses it for the few strings it carries: once the module brings its full
 * catalog, that one wins, and an index loaded later never shadows it.
 */
export function registerSurfaceLocaleFallbacks(
	surfaceId: string,
	locales: Record<string, SurfaceMessages>,
): void {
	const present = LocaleController.getInstance().getLocales(surfaceId) ?? {};
	const missing = Object.fromEntries(
		Object.entries(locales).filter(([locale]) => !(locale in present)),
	);
	if (Object.keys(missing).length === 0) return;
	LocaleController.getInstance().setLocales(surfaceId, missing);
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
