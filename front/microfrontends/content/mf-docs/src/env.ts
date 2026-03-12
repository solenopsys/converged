export type DocsSource = {
  name: string;
  id: string;
};

const MF_NAME = "mf-docs";
const DEFAULT_DOCS: DocsSource[] = [
  { name: "club", id: "ru/club/index.json" },
];

export function getDocsSources(): DocsSource[] {
  const globalEnv = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const mfEnv = (globalEnv[MF_NAME] ?? {}) as Record<string, unknown>;
  const rawDocs = mfEnv.docs;

  if (!Array.isArray(rawDocs)) {
    return DEFAULT_DOCS;
  }

  const normalized = rawDocs
    .map((item, index) => normalizeSource(item, index))
    .filter((item): item is DocsSource => item !== null);

  return normalized.length > 0 ? normalized : DEFAULT_DOCS;
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
