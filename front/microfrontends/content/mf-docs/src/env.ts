import {
  DEFAULT_LOCALE,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "front-core/landing-common/i18n";

export type DocsSource = {
  name: string;
  id: string;
};

const MF_NAME = "mf-docs";

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

function buildDefaultDocs(locale: SupportedLocale): DocsSource[] {
  return [{ name: "club", id: `${locale}/club/index.json` }];
}

export function getDocsSources(): DocsSource[] {
  const locale = resolveRuntimeLocale();
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const rawDocs = mfEnv.docs;

  if (!Array.isArray(rawDocs)) {
    return buildDefaultDocs(locale);
  }

  const normalized = rawDocs
    .map((item, index) => normalizeSource(item, index))
    .filter((item): item is DocsSource => item !== null)
    .map((item) => ({ ...item, id: withLocalePrefix(item.id, locale) }));

  return normalized.length > 0 ? normalized : buildDefaultDocs(locale);
}

export function docsSourceKey(source: DocsSource): string {
  return slugify(source.name || source.id || "docs");
}

function normalizeSource(value: unknown, index: number): DocsSource | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;

  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name.trim()
      : `docs-${index + 1}`;

  return { name, id };
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
  return normalized || "docs";
}
