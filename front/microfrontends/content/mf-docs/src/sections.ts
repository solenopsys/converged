import { createStructServiceClient } from "g-struct";

export type DocsSectionMeta = {
  id: string;
  slug: string;
  anchor: string;
  title: string;
  order: number;
  markdownPath: string;
};

const structClient = createStructServiceClient({ baseUrl: "/services" });

export async function loadDocsSections(indexPath: string): Promise<DocsSectionMeta[]> {
  const structData = await structClient.readJson(indexPath);
  return normalizeStructDocs(structData, indexPath).sort((a, b) => a.order - b.order);
}

export function anchorActionId(sourceKey: string, anchor: string): string {
  return `docs.anchor.${sourceKey}.${anchor}`;
}

function normalizeStructDocs(data: unknown, indexPath: string): DocsSectionMeta[] {
  if (!Array.isArray(data)) return [];

  const docs: DocsSectionMeta[] = [];
  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    const record = (item ?? {}) as Record<string, unknown>;
    const rawId = record.id ?? record.slug;
    if (typeof rawId !== "string" || rawId.length === 0) continue;

    const slugFromId = rawId
      .split("/")
      .pop()
      ?.replace(/\.md$/i, "");

    const rawSlug =
      typeof record.slug === "string" && record.slug.trim().length > 0
        ? record.slug
        : (slugFromId ?? rawId);

    docs.push({
      id: rawId,
      slug: rawSlug,
      anchor: toAnchor(rawSlug, index),
      title:
        typeof record.title === "string" && record.title.trim().length > 0
          ? record.title
          : rawSlug,
      order:
        typeof record.order === "number"
          ? record.order
          : Number.MAX_SAFE_INTEGER,
      markdownPath: toMarkdownPath(rawId, indexPath),
    });
  }

  return docs;
}

function toMarkdownPath(rawId: string, indexPath: string): string {
  const base = rawId.endsWith(".md") ? rawId : `${rawId}.md`;
  if (base.includes("/")) return base;
  const folder = indexPath.split("/").slice(0, -1).join("/");
  return folder ? `${folder}/${base}` : base;
}

function toAnchor(value: string, index: number): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
  return normalized || `section-${index + 1}`;
}
