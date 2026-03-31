export const SUPPORTED_LOCALES = ['en', 'ru', 'de', 'fr', 'es', 'it', 'pt'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export type LangItem = { code: SupportedLocale; name: string };

export const AVAILABLE_LANGS: LangItem[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
];

export function isSupportedLocale(
  value: string | undefined | null,
): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    const code = lang.split('-')[0].toLowerCase();
    if (isSupportedLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function extractLocaleFromPath(path: string): SupportedLocale | null {
  const normalized = normalizePath(path);
  const firstSegment = normalized.split('/')[1];
  return isSupportedLocale(firstSegment) ? firstSegment : null;
}

export function buildLocalePath(locale: SupportedLocale, path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return `/${locale}/`;
  return `/${locale}${normalized}`;
}
