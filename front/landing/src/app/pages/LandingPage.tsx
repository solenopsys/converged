import { useMemo } from "react";
import { useParams } from "react-router-dom";
import LandingView from "../../../../microfrontends/content/mf-landing/src/views/LandingView";
import { DEFAULT_LOCALE, extractLocaleFromPath, isSupportedLocale, type SupportedLocale } from "../i18n";

const LANDING_CONF_SUFFIX = "product/landing/4ir-laiding.json";

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

function resolveLandingConfigPath(locale: SupportedLocale): string {
  const landingMap = (globalThis as any).__LANDING_SSR_DATA__;
  if (landingMap && typeof landingMap === "object") {
    const localizedKey = Object.keys(landingMap).find((key) => key.startsWith(`${locale}/`));
    if (localizedKey) {
      return localizedKey;
    }
    const firstKey = Object.keys(landingMap)[0];
    if (typeof firstKey === "string" && firstKey.trim().length > 0) {
      return withLocalePrefix(firstKey, locale);
    }
  }

  const value = (globalThis as any).__MF_ENV__?.["mf-landing"]?.landingConfId;
  if (typeof value === "string" && value.trim().length > 0) {
    return withLocalePrefix(value, locale);
  }

  return `${locale}/${LANDING_CONF_SUFFIX}`;
}

export function LandingPage() {
  const { locale } = useParams<{ locale?: string }>();
  const activeLocale = isSupportedLocale(locale)
    ? locale
    : (typeof window !== "undefined" ? extractLocaleFromPath(window.location.pathname) : null) ?? DEFAULT_LOCALE;
  const landingConfigPath = useMemo(() => resolveLandingConfigPath(activeLocale), [activeLocale]);
  return <LandingView configPath={landingConfigPath} />;
}
