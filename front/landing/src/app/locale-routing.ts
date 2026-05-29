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

export const DEFAULT_LOCALE_ROUTING: LocaleRoutingConfig = {
  mode: "multi",
  locale: DEFAULT_LOCALE,
};

type InitialDataWithLocalization = {
  localization?: Partial<LocaleRoutingConfig> | null;
};

declare global {
  var __INITIAL_DATA__:
    | (InitialDataWithLocalization & Record<string, unknown>)
    | undefined;
}

function normalizeLocaleRouting(value: unknown): LocaleRoutingConfig {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mode = record.mode === "single" ? "single" : "multi";
  const localeRaw = typeof record.locale === "string" ? record.locale : undefined;
  return {
    mode,
    locale: isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE,
  };
}

export function readLocaleRouting(): LocaleRoutingConfig {
  const direct = normalizeLocaleRouting(globalThis.__INITIAL_DATA__?.localization);
  if (direct.mode === "single") return direct;

  if (typeof document === "undefined") return direct;
  const el = document.getElementById("__INITIAL_DATA__");
  if (!el?.textContent) return direct;
  try {
    const parsed = JSON.parse(el.textContent) as InitialDataWithLocalization;
    return normalizeLocaleRouting(parsed?.localization);
  } catch {
    return direct;
  }
}

export function resolveActiveLocale(rawLocale?: string | null): SupportedLocale {
  const routing = readLocaleRouting();
  if (routing.mode === "single") return routing.locale;
  if (isSupportedLocale(rawLocale)) return rawLocale;
  if (typeof window !== "undefined") {
    return extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

export function buildAppPath(path: string, locale?: SupportedLocale): string {
  const routing = readLocaleRouting();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (routing.mode === "single") return normalized;
  const targetLocale = locale ?? routing.locale;
  if (normalized === "/") return `/${targetLocale}/`;
  return `/${targetLocale}${normalized}`;
}
