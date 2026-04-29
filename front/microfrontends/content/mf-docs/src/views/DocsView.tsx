import { useEffect, useMemo, useRef, useState } from "react";
import { createMarkdownServiceClient } from "g-markdown";
import { MarkdownRenderer, type MarkdownASTNode } from "md-tools";
import { loadDocsSections, type DocsSectionMeta } from "../sections";
import { getDocsSources } from "../env";
import { DEFAULT_LOCALE } from "front-core/landing-common/i18n";
import type { DocsSSRData } from "../ssr";

type RenderSection = DocsSectionMeta & {
  ast: MarkdownASTNode | null;
};

const markdownClient = createMarkdownServiceClient({ baseUrl: "/services" });

function readSsrData(indexPath: string): RenderSection[] | null {
  const data: DocsSSRData | undefined =
    typeof window === "undefined"
      ? (globalThis as any).__DOCS_SSR_DATA__
      : (() => {
          try {
            const el = document.getElementById("__INITIAL_DATA__");
            return el?.textContent ? (JSON.parse(el.textContent) as any)?.docsContent : undefined;
          } catch { return undefined; }
        })();
  if (!data || data.indexPath !== indexPath) return null;
  return data.sections as RenderSection[];
}

export default function DocsView({ indexPath, anchor }: { indexPath?: string; anchor?: string }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const resolvedIndexPath = indexPath ?? getDocsSources()[0]?.id ?? `${DEFAULT_LOCALE}/club/index.json`;

  const ssrSections = readSsrData(resolvedIndexPath);
  const [sections, setSections] = useState<RenderSection[]>(ssrSections ?? []);
  const [loading, setLoading] = useState(!ssrSections);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ssrSections) return;
    let active = true;

    const loadAllSections = async () => {
      setLoading(true);
      setError(null);
      try {
        const docsSections = await loadDocsSections(resolvedIndexPath);
        if (!active) return;

        const paths = docsSections.map((item) => item.markdownPath);
        const batch = paths.length ? await markdownClient.readMdJsonBatch(paths) : [];
        if (!active) return;

        setSections(docsSections.map((item, index) => ({
          ...item,
          ast: (Array.isArray(batch) ? batch[index]?.content : null) as MarkdownASTNode | null ?? null,
        })));
      } catch (e: any) {
        if (!active) return;
        setSections([]);
        setError(e?.message ?? "Failed to load docs");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllSections();
    return () => { active = false; };
  }, [resolvedIndexPath]);

  const sortedItems = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections],
  );

  useEffect(() => {
    if (!anchor || loading) return;
    const id = anchor.trim().toLowerCase();
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      const section = container.querySelector<HTMLElement>(`#${id}`);
      if (section) {
        container.scrollTo({ top: section.offsetTop - 8, behavior: "smooth" });
      }
    });
  }, [anchor, loading, sortedItems.length]);

  useEffect(() => {
    if (typeof document === "undefined" || loading) return;
    document.dispatchEvent(new CustomEvent("club:docs:sections-changed"));
  }, [loading, sortedItems.length, resolvedIndexPath]);

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden px-6 py-8"
      data-docs-root="1"
      data-docs-index-path={resolvedIndexPath}
    >
      {error ? (
        <div className="max-w-4xl">
          <h2 className="mb-3 text-2xl font-semibold text-red-400">Error</h2>
          <p className="text-slate-300">{error}</p>
        </div>
      ) : null}

      {!error && loading ? <p className="text-slate-300">Loading...</p> : null}

      {!error && !loading && sortedItems.length === 0 ? (
        <p className="text-slate-300">No sections found in struct: {resolvedIndexPath}</p>
      ) : null}

      {!error && !loading
        ? sortedItems.map((item) => (
            <section
              key={item.anchor}
              id={item.anchor}
              className="mb-12 scroll-mt-4"
              data-docs-section="1"
              data-docs-section-anchor={item.anchor}
              data-docs-section-name={item.title || item.anchor}
            >
              {item.ast ? (
                <div className="docs-markdown max-w-4xl">
                  <MarkdownRenderer ast={item.ast} />
                </div>
              ) : (
                <p className="text-slate-400">No content for {item.title}</p>
              )}
            </section>
          ))
        : null}
    </div>
  );
}
