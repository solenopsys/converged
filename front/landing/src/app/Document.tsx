import type { ReactNode } from "react";
import {
  SsrShellLayout,
  preSsrShellCss,
  themeBootstrapScript,
} from "front-core/landing-common/ssr-shell";

export interface SeoMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
}

interface DocumentProps {
  children: ReactNode;
  seo?: SeoMeta;
  lang?: string;
  importMap?: Record<string, string>;
  initialData?: Record<string, unknown>;
}

export function Document({ children, seo, lang = "en", importMap, initialData }: DocumentProps) {
  const title = seo?.title ?? "Landing";
  const description = seo?.description ?? "";
  const keywords = seo?.keywords?.filter(Boolean).join(", ") ?? "";
  const canonical = seo?.canonical;
  const ogImage = seo?.ogImage;

  const importMapJson = importMap ? JSON.stringify({ imports: importMap }) : null;
  const initialDataJson = initialData ? JSON.stringify(initialData) : null;

  return (
    <html lang={lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="dark light" />
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        {keywords ? <meta name="keywords" content={keywords} /> : null}
        <meta name="robots" content="index,follow" />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {description ? <meta property="og:description" content={description} /> : null}
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {description ? <meta name="twitter:description" content={description} /> : null}
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <style dangerouslySetInnerHTML={{ __html: preSsrShellCss }} />
        {importMapJson ? (
          <script type="importmap" dangerouslySetInnerHTML={{ __html: importMapJson }} />
        ) : null}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/spa.css" />
      </head>
      <body>
        {initialDataJson ? (
          <script
            id="__INITIAL_DATA__"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: initialDataJson }}
          />
        ) : null}

        <SsrShellLayout>{children}</SsrShellLayout>

        {/* Warmup: preloads SPA modules in background */}
        <div data-island="warmup" data-island-load="eager" style={{ display: "none" }} />

        <script type="module" src="/island-client.js" />
      </body>
    </html>
  );
}
