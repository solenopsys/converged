import { createStructServiceClient } from "g-struct";
import { createMarkdownServiceClient } from "g-markdown";
import { createFrontNrpcClientConfig } from "signal-channel";
import { loadDocsSectionsWithClient, type DocsSectionMeta } from "./sections";

export type DocsSectionWithAst = DocsSectionMeta & { ast: unknown | null };

export type DocsSSRData = {
  indexPath: string;
  sections: DocsSectionWithAst[];
};

export async function prefetchDocs(indexPath: string, _servicesBaseUrl: string): Promise<DocsSSRData> {
  const structClient = createStructServiceClient(createFrontNrpcClientConfig());
  const markdownClient = createMarkdownServiceClient(createFrontNrpcClientConfig());

  const sections = await loadDocsSectionsWithClient(indexPath, structClient);

  const localePrefix = indexPath.split("/")[0] + "/";
  const paths = sections.map((s) =>
    s.markdownPath.includes("/") && !s.markdownPath.startsWith(localePrefix)
      ? localePrefix + s.markdownPath
      : s.markdownPath,
  );

  let batch: any[] = [];
  try {
    batch = paths.length > 0 ? await markdownClient.readMdJsonBatch(paths) : [];
  } catch {
    // markdown files may not exist yet — return sections with null ast
  }

  return {
    indexPath,
    sections: sections.map((s, i) => ({
      ...s,
      ast: Array.isArray(batch) ? (batch[i]?.content ?? null) : null,
    })),
  };
}
