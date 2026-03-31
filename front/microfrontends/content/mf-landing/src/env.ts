import {
  DEFAULT_LOCALE,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "front-core/landing-common/i18n";

const MF_NAME = "mf-landing";
const CONFIG_SUFFIX = "product/landing/4ir-laiding.json";
const DEFAULT_TITLE = "4ir";

function resolveRuntimeLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
}

function withLocalePrefix(path: string, locale: SupportedLocale): string {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized) return `${locale}/`;
  const segments = normalized.split("/");
  if (isSupportedLocale(segments[0])) {
    segments[0] = locale;
    return segments.join("/");
  }
  return `${locale}/${normalized}`;
}

export function getLandingConfigPath(): string {
  const locale = resolveRuntimeLocale();
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const value = mfEnv.landingConfId;
  if (typeof value === "string" && value.trim().length > 0) {
    return withLocalePrefix(value, locale);
  }
  return `${locale}/${CONFIG_SUFFIX}`;
}

export function getLandingMenuTitle(): string {
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const value = mfEnv.title;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_TITLE;
}
