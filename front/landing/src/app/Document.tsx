import type { ReactNode } from "react";

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
  noHydrate?: boolean;
  initialData?: Record<string, any>;
  importMap?: Record<string, string>;
}

export function Document({ children, seo, noHydrate, initialData, importMap }: DocumentProps) {
  const title = seo?.title ?? "Landing";
  const description = seo?.description ?? "";
  const keywords = seo?.keywords?.filter(Boolean).join(", ") ?? "";
  const canonical = seo?.canonical;
  const ogImage = seo?.ogImage;
  const themeBootstrapScript = `
    (() => {
      try {
        const stored = localStorage.getItem("theme");
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = stored === "light" || stored === "dark"
          ? stored
          : (prefersDark ? "dark" : "light");
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
      } catch (_) {}
    })();
  `;

  return (
    <html lang="en">
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
        {description ? (
          <meta property="og:description" content={description} />
        ) : null}
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {description ? (
          <meta name="twitter:description" content={description} />
        ) : null}
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrapScript,
          }}
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="stylesheet" href="/styles.css" />
        {importMap && (
          <script type="importmap" dangerouslySetInnerHTML={{
            __html: JSON.stringify({ imports: importMap })
          }} />
        )}
      </head>
      <body>
        <div id="root">{children}</div>
        {initialData && (
          <script
            id="__INITIAL_DATA__"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(initialData) }}
          />
        )}
        {!noHydrate && <script type="module" src="/client.js" />}
      </body>
    </html>
  );
}
