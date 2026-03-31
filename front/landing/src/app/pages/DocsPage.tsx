import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MdView } from "../components/MdView";
import { Button } from "front-core";
import { createMarkdownServiceClient } from "g-markdown";
import { DEFAULT_LOCALE, buildLocalePath, isSupportedLocale } from "../i18n";

const markdownClient = createMarkdownServiceClient({
  baseUrl: "/services",
});

declare global {
  var __DOCS_SSR_DATA__: Record<string, {
    slug: string;
    markdownPath: string;
    ast: any;
    error?: string;
  }> | undefined;
}

function resolveDocPath(locale: string, slug: string) {
  if (slug === "club") return `${locale}/club/intro.md`;
  if (slug.includes("/")) return `${locale}/${slug.replace(/^\/+/, "")}`;
  return `${locale}/${slug}.md`;
}

export function DocsPage() {
  const { slug, locale } = useParams<{ slug: string; locale: string }>();
  const activeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const initialRaw = typeof slug === "string" ? globalThis.__DOCS_SSR_DATA__?.[slug] : undefined;
  const initialData = initialRaw && typeof initialRaw.markdownPath === "string"
    && initialRaw.markdownPath.startsWith(`${activeLocale}/`)
    ? initialRaw
    : undefined;
  const [ast, setAst] = useState<any>(initialData?.ast ?? null);
  const [error, setError] = useState<string | undefined>(initialData?.error);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!slug) {
        if (active) {
          setAst(null);
          setError("Document slug is missing");
          setLoading(false);
        }
        return;
      }

      const preloaded = globalThis.__DOCS_SSR_DATA__?.[slug];
      if (preloaded) {
        const isMatchingLocale = typeof preloaded.markdownPath === "string"
          && preloaded.markdownPath.startsWith(`${activeLocale}/`);
        if (!isMatchingLocale) {
          // Ignore stale prefetch from another locale.
        } else {
          if (active) {
            setAst(preloaded.ast ?? null);
            setError(preloaded.error);
            setLoading(false);
          }
          return;
        }
      }

      setLoading(true);
      setError(undefined);
      try {
        const result = await markdownClient.readMdJson(resolveDocPath(activeLocale, slug));
        if (!active) return;
        setAst(result.content ?? null);
      } catch (e: any) {
        if (active) {
          setAst(null);
          setError(e?.message ?? "Failed to load document");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [activeLocale, slug]);

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-3xl mx-auto mb-6 flex gap-3">
        <Button asChild variant={slug === "page1" ? "default" : "outline"}>
          <Link to={buildLocalePath(activeLocale, "/docs/page1")}>Page 1</Link>
        </Button>
        <Button asChild variant={slug === "page2" ? "default" : "outline"}>
          <Link to={buildLocalePath(activeLocale, "/docs/page2")}>Page 2</Link>
        </Button>
      </div>
      <MdView ast={ast} error={error} loading={loading} />
    </div>
  );
}
