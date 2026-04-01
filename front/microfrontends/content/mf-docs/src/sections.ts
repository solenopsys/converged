import { createStructServiceClient } from "g-struct";

export type DocsSectionMeta = {
  id: string;
  slug: string;
  anchor: string;
  title: string;
  order: number;
  markdownPath: string;
  group?: string;
};

type CompoundGroup = { group: string; index: string };
type CompoundIndex = { compound: true; groups: CompoundGroup[] };

const structClient = createStructServiceClient({ baseUrl: "/services" });

export async function loadDocsSections(indexPath: string): Promise<DocsSectionMeta[]> {
  const structData = await structClient.readJson(indexPath);
  if (isCompoundIndex(structData)) {
    return loadCompoundSections(structData, indexPath, structClient);
  }
  return normalizeStructDocs(structData, indexPath).sort((a, b) => a.order - b.order);
}

export async function loadDocsSectionsWithClient(
  indexPath: string,
  client: { readJson(path: string): Promise<unknown> },
): Promise<DocsSectionMeta[]> {
  const structData = await client.readJson(indexPath);
  if (isCompoundIndex(structData)) {
    return loadCompoundSections(structData, indexPath, client);
  }
  return normalizeStructDocs(structData, indexPath).sort((a, b) => a.order - b.order);
}

export function anchorActionId(sourceKey: string, anchor: string): string {
  return `docs.anchor.${sourceKey}.${anchor}`;
}

function isCompoundIndex(data: unknown): data is CompoundIndex {
  return (
    data !== null &&
    typeof data === "object" &&
    (data as any).compound === true &&
    Array.isArray((data as any).groups)
  );
}

async function loadCompoundSections(
  compound: CompoundIndex,
  compoundPath: string,
  client: { readJson(path: string): Promise<unknown> },
): Promise<DocsSectionMeta[]> {
  const locale = compoundPath.split("/")[0];
  const all: DocsSectionMeta[] = [];
  let globalOrder = 0;

  for (const entry of compound.groups) {
    const subPath = `${locale}/${entry.index}`;
    try {
      const subData = await client.readJson(subPath);
      const sections = normalizeStructDocs(subData, subPath)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ ...s, order: globalOrder++, group: entry.group }));
      all.push(...sections);
    } catch {
      // sub-index missing — skip
    }
  }

  return all;
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
