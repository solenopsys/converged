export const SUPPORTED_LOCALES = ["en", "ru"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function extractLocaleFromPath(path: string): SupportedLocale | null {
  const normalized = normalizePath(path);
  const firstSegment = normalized.split("/")[1];
  return isSupportedLocale(firstSegment) ? firstSegment : null;
}

export function buildLocalePath(locale: SupportedLocale, path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return `/${locale}/`;
  return `/${locale}${normalized}`;
}
