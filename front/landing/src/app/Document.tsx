import type { ReactNode } from "react";
import {
  SsrShellLayout,
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
  logoLight?: string;
  logoDark?: string;
  // Primary public phone, resolved from ms-audio-gate (AudioGateService) at SSR.
  phone?: string;
}

type TopBarMenuLink = {
  label: string;
  href: string;
};

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBlockNavLabel(block: unknown): string {
  if (!block || typeof block !== "object") return "";
  const record = block as Record<string, unknown>;
  const props = record.props && typeof record.props === "object"
    ? record.props as Record<string, unknown>
    : {};
  const explicit = readTrimmedString(props.navLabel);
  if (explicit) return explicit;

  const data = record.data && typeof record.data === "object"
    ? record.data as Record<string, unknown>
    : {};
  for (const source of Object.values(data)) {
    if (!source || typeof source !== "object") continue;
    const sourceRecord = source as Record<string, unknown>;
    const navLabel = readTrimmedString(sourceRecord.navLabel);
    if (navLabel) return navLabel;
    const title = readTrimmedString(sourceRecord.title);
    if (title) return title;
    const railLabel = readTrimmedString(sourceRecord.railLabel);
    if (railLabel) return railLabel;
    const headline = readTrimmedString(sourceRecord.headline);
    if (headline) return headline;
  }

  return "";
}

function createBlockLabelMap(blocks: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(blocks)) return map;

  blocks.forEach((block) => {
    if (!block || typeof block !== "object") return;
    const id = readTrimmedString((block as Record<string, unknown>).id);
    const label = readBlockNavLabel(block);
    if (id && label) map.set(id, label);
  });

  return map;
}

function normalizeTopBarMenuLinks(value: unknown, blockLabels = new Map<string, string>()): TopBarMenuLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): TopBarMenuLink[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const explicitLabel = readTrimmedString(record.label);
    const explicitHref = typeof record.href === "string" ? record.href.trim() : "";
    const targetId =
      typeof record.blockId === "string" && record.blockId.trim()
        ? record.blockId.trim()
        : typeof record.sectionId === "string" && record.sectionId.trim()
          ? record.sectionId.trim()
          : typeof record.targetId === "string" && record.targetId.trim()
            ? record.targetId.trim()
            : "";
    const href = explicitHref || (targetId ? `#${targetId.replace(/^#/, "")}` : "");
    const label = explicitLabel || (targetId ? blockLabels.get(targetId) ?? "" : "");
    return label && href ? [{ label, href }] : [];
  });
}

function readTopBarMenuLinks(initialData: Record<string, unknown> | undefined): TopBarMenuLink[] {
  const landing = initialData?.landing;
  if (!landing || typeof landing !== "object") return [];

  for (const payload of Object.values(landing as Record<string, unknown>)) {
    if (!payload || typeof payload !== "object") continue;
    const navigation = (payload as { navigation?: unknown }).navigation;
    if (!navigation || typeof navigation !== "object") continue;
    const blockLabels = createBlockLabelMap(
      (payload as { blocks?: unknown }).blocks,
    );
    const links = normalizeTopBarMenuLinks(
      (navigation as { menuLinks?: unknown }).menuLinks,
      blockLabels,
    );
    if (links.length > 0) return links;
  }

  return [];
}

export function Document({ children, seo, lang = "en", importMap, initialData, logoLight, logoDark, phone: phoneProp }: DocumentProps) {
  const title = seo?.title ?? "Landing";
  const description = seo?.description ?? "";
  const keywords = seo?.keywords?.filter(Boolean).join(", ") ?? "";
  const canonical = seo?.canonical;
  const ogImage = seo?.ogImage;

  const importMapJson = importMap ? JSON.stringify({ imports: importMap }) : null;
  const initialDataJson = initialData ? JSON.stringify(initialData) : null;
  const loginEnabled = String(process.env.LOGIN_ENABLED ?? "").toLowerCase() === "true";
  const phone = phoneProp?.trim() || process.env.LANDING_PHONE?.trim() || "";
  const topBarMenuLinks = readTopBarMenuLinks(initialData);

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
        {importMapJson ? (
          <script type="importmap" dangerouslySetInnerHTML={{ __html: importMapJson }} />
        ) : null}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        {initialDataJson ? (
          <script
            id="__INITIAL_DATA__"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: initialDataJson }}
          />
        ) : null}

        <SsrShellLayout
          loginEnabled={loginEnabled}
          logoLight={logoLight ?? "/services/galery/static/logo.png"}
          logoDark={logoDark ?? "/services/galery/static/logo.png"}
          chatPlaceholder="Ask Convo anything..."
          brandName="Converged AI"
          phone={phone}
          menuLinks={topBarMenuLinks}
        >{children}</SsrShellLayout>

        {/* Warmup: preloads SPA modules in background */}
        <div data-island="warmup" data-island-load="eager" style={{ display: "none" }} />

        <script type="module" src="/island-client.js" />
      </body>
    </html>
  );
}
