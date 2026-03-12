import { useEffect, useMemo, useRef, useState } from "react";
import { createMarkdownServiceClient } from "g-markdown";
import { MarkdownRenderer, type MarkdownASTNode } from "md-tools";
import { loadDocsSections, type DocsSectionMeta } from "../sections";
import { getDocsSources } from "../env";

type RenderSection = DocsSectionMeta & {
  ast: MarkdownASTNode | null;
};

const markdownClient = createMarkdownServiceClient({ baseUrl: "/services" });

export default function DocsView({ indexPath, anchor }: { indexPath?: string; anchor?: string }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [sections, setSections] = useState<RenderSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedIndexPath = indexPath ?? getDocsSources()[0]?.id ?? "ru/club/index.json";

  useEffect(() => {
    let active = true;

    const loadAllSections = async () => {
      setLoading(true);
      setError(null);
      try {
        const docsSections = await loadDocsSections(resolvedIndexPath);
        if (!active) return;

        const paths = docsSections.map((item) => item.markdownPath);
        const batch = paths.length
          ? await markdownClient.readMdJsonBatch(paths)
          : [];
        if (!active) return;

        const nextSections: RenderSection[] = docsSections.map((item, index) => {
          const payload = Array.isArray(batch) ? batch[index] : null;
          return {
            ...item,
            ast: (payload?.content as MarkdownASTNode | null | undefined) ?? null,
          };
        });

        setSections(nextSections);
      } catch (e: any) {
        if (!active) return;
        setSections([]);
        setError(e?.message ?? "Failed to load docs");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllSections();
    return () => {
      active = false;
    };
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

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden p-6"
    >
      {error ? (
        <div className="max-w-4xl">
          <h2 className="mb-3 text-2xl font-semibold text-red-400">Error</h2>
          <p className="text-slate-300">{error}</p>
        </div>
      ) : null}

      {!error && loading ? (
        <p className="text-slate-300">Loading...</p>
      ) : null}

      {!error && !loading && sortedItems.length === 0 ? (
        <p className="text-slate-300">No sections found in struct: {resolvedIndexPath}</p>
      ) : null}

      {!error && !loading
        ? sortedItems.map((item) => (
            <section
              key={item.anchor}
              id={item.anchor}
              className="mb-12 scroll-mt-4"
            >
              {item.ast ? (
                <div className="prose prose-invert max-w-4xl">
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
