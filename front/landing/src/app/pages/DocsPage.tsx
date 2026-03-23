import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MdView } from "../components/MdView";
import { Button } from "front-core";
import { createMarkdownServiceClient } from "g-markdown";
import { DEFAULT_LOCALE, buildLocalePath, isSupportedLocale } from "../i18n";

const markdownClient = createMarkdownServiceClient({
  baseUrl: "/services",
});

function resolveDocPath(slug: string) {
  if (slug === "club") return "ru/club/intro.md";
  return `${slug}.md`;
}

export function DocsPage() {
  const { slug, locale } = useParams<{ slug: string; locale: string }>();
  const activeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const [ast, setAst] = useState<any>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      setError(undefined);
      try {
        const result = await markdownClient.readMdJson(resolveDocPath(slug));
        if (!active) return;
        setAst(result.content ?? null);
      } catch (e: any) {
        if (!active) return;
        setAst(null);
        setError(e?.message ?? "Failed to load document");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [slug]);

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
