import { createEvent, createStore } from 'effector';
import { initI18n } from '../i18n';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from '../landing-common/i18n';

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES as readonly string[]);

export const localeSetRequested = createEvent<SupportedLocale>();
export const localePathHydrated = createEvent<string>();

export const $activeLocale = createStore<SupportedLocale>(DEFAULT_LOCALE)
  .on(localeSetRequested, (_, locale) => locale)
  .on(localePathHydrated, (_, pathname) => extractLocaleFromPath(pathname) ?? DEFAULT_LOCALE);

function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!supportedLocaleSet.has(normalized)) return null;
  return isSupportedLocale(normalized) ? normalized : null;
}

export class LocaleController {
  private static instance: LocaleController | null = null;
  private locales: { [id: string]: any } = {};

  private toMicrofrontendNamespace(microfrontendId: string): string {
    if (microfrontendId.startsWith('mf-')) return microfrontendId;
    if (microfrontendId.endsWith('-mf')) {
      return `mf-${microfrontendId.slice(0, -3)}`;
    }
    return microfrontendId;
  }

  private normalizeLocaleUrl(
    rawUrl: unknown,
    lang: string,
    namespace: string,
  ): unknown {
    if (typeof rawUrl !== 'string') return rawUrl;

    // Most microfrontends register "../locales/{lang}.json", which resolves
    // to "/locales/{lang}.json" at runtime and points to core locales.
    // Rewrite to "/locales/{lang}/{namespace}.json" served by spa plugin.
    const matcher = new RegExp(
      `(^|/)locales/${lang}\\.json([?#].*)?$`,
      'i',
    );

    if (!matcher.test(rawUrl)) return rawUrl;

    return rawUrl.replace(
      matcher,
      `$1locales/${lang}/${namespace}.json$2`,
    );
  }

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

  hydrateFromPath(pathname: string): SupportedLocale {
    localePathHydrated(pathname);
    return $activeLocale.getState();
  }

  async switchSpaLocale(nextLocale: string): Promise<SupportedLocale | null> {
    const locale = normalizeLocale(nextLocale);
    if (!locale) return null;

    localeSetRequested(locale);

    try {
      const i18n = await initI18n();
      if (i18n.language !== locale) {
        await i18n.changeLanguage(locale);
      }
    } catch (error) {
      console.error('[locale] failed to switch language', error);
    }

    return locale;
  }

  setLocales(microfrontendId: string, locales: any): void {
    const namespace = this.toMicrofrontendNamespace(microfrontendId);

    if (!locales || typeof locales !== 'object') {
      this.locales[microfrontendId] = locales;
      return;
    }

    const normalizedLocales: Record<string, unknown> = {};
    for (const [lang, url] of Object.entries(locales)) {
      normalizedLocales[lang] = this.normalizeLocaleUrl(url, lang, namespace);
    }

    this.locales[microfrontendId] = normalizedLocales;
  }

  getLocales(microfrontendId: string): any {
    return this.locales[microfrontendId];
  }
}
