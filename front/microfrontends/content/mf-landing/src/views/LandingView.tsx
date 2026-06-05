import { useEffect, useMemo, useState } from "react";
import { createStructServiceClient } from "g-struct";
import {
  DEFAULT_LOCALE,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "front-core/landing-common/i18n";
import {
  HeroRequestBanner,
  type HeroRequestBannerData,
  LandingSectionRailBlock,
  type LandingSectionRailBlockData,
} from "front-core";
import { openLoginPanel } from "front-core/landing-common/island-client";
import {
  AISection,
  ComparisonTable,
  Feature,
  Hero,
  HeroMain,
  Logos8,
  MagicCTA,
  Pricing2,
  Stats,
  VideoBlock,
} from "front-landings";
import "./LandingView.css";

type LandingBlockConfig = {
  id?: string;
  type: string;
  sources?: Record<string, string>;
  props?: Record<string, unknown>;
};

type LandingConfig = {
  id?: string;
  title?: string;
  blocks?: LandingBlockConfig[];
};

type ResolvedBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  data: Record<string, unknown>;
};

type ContactMapBlockData = {
  address?: string;
  email?: string;
  hours?: string[];
  mapEmbedUrl?: string;
  mapQuery?: string;
  phone?: string;
  title?: string;
  subtitle?: string;
};

type CertificateItem = {
  description?: string;
  id?: string;
  issuer?: string;
  standard?: string;
  title?: string;
  validUntil?: string;
  image?: string;
};

type CertificatesBlockData = {
  title?: string;
  subtitle?: string;
  items?: CertificateItem[];
};

type ShopProofMetric = {
  label?: string;
  value?: string;
};

type ShopProofBlockData = {
  eyebrow?: string;
  title?: string;
  copy?: string;
  points?: string[];
  metrics?: ShopProofMetric[];
};

type LandingPrefetchPayload = {
  configPath: string;
  blocks: ResolvedBlock[];
};

const structClient = createStructServiceClient({ baseUrl: "/services" });

declare global {
  var __LANDING_SSR_DATA__: Record<string, LandingPrefetchPayload> | undefined;
}

function readLandingPrefetchMap(): Record<string, LandingPrefetchPayload> {
  const direct = globalThis.__LANDING_SSR_DATA__;
  if (direct && typeof direct === "object") {
    return direct;
  }

  if (typeof window === "undefined") {
    return {};
  }

  const initialDataScript = document.getElementById("__INITIAL_DATA__");
  if (!initialDataScript?.textContent) {
    return {};
  }

  try {
    const parsed = JSON.parse(initialDataScript.textContent) as {
      landing?: Record<string, LandingPrefetchPayload>;
    };
    const landing =
      parsed?.landing && typeof parsed.landing === "object"
        ? parsed.landing
        : {};
    globalThis.__LANDING_SSR_DATA__ = landing;
    return landing;
  } catch {
    return {};
  }
}

function getPrefetchedBlocks(configPath: string): ResolvedBlock[] | null {
  const map = readLandingPrefetchMap();
  const payload = map[configPath];
  return Array.isArray(payload?.blocks) ? payload.blocks : null;
}

function resolveFallbackLocale(configPath: string): SupportedLocale {
  const configLocale = configPath.split("/")[0]?.toLowerCase();
  if (isSupportedLocale(configLocale)) {
    return configLocale;
  }
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
}

export default function LandingView({ configPath }: { configPath: string }) {
  const prefetchedBlocks = useMemo(() => getPrefetchedBlocks(configPath), [configPath]);
  const fallbackLocale = useMemo(() => resolveFallbackLocale(configPath), [configPath]);
  const [blocks, setBlocks] = useState<ResolvedBlock[]>(() => prefetchedBlocks ?? []);
  const [loading, setLoading] = useState(() => !prefetchedBlocks);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefetchedBlocks) {
      setBlocks(prefetchedBlocks);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;

    const locale = configPath.split("/")[0] ?? "";

    function localizeSourcePath(p: string): string {
      if (!locale || p.startsWith(`${locale}/`)) return p;
      return `${locale}/${p}`;
    }

    const loadLanding = async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = (await structClient.readJson(configPath)) as LandingConfig;
        if (!active) return;

        const baseBlocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
        const rawSourcePaths = Array.from(
          new Set(
            baseBlocks.flatMap((block) =>
              Object.values(block.sources ?? {}).filter(
                (value): value is string =>
                  typeof value === "string" && value.length > 0,
              ),
            ),
          ),
        );
        const sourcePaths = rawSourcePaths.map(localizeSourcePath);

        const sourceValues = sourcePaths.length
          ? await structClient.readJsonBatch(sourcePaths)
          : [];
        if (!active) return;

        const sourceMap = new Map<string, unknown>();
        sourcePaths.forEach((path, index) => {
          sourceMap.set(path, Array.isArray(sourceValues) ? sourceValues[index] : undefined);
        });

        const resolved: ResolvedBlock[] = baseBlocks.map((block, index) => {
          const data: Record<string, unknown> = {};
          for (const [alias, path] of Object.entries(block.sources ?? {})) {
            data[alias] = sourceMap.get(localizeSourcePath(path));
          }
          return {
            id: block.id || `${block.type}-${index}`,
            type: block.type,
            props: block.props ?? {},
            data,
          };
        });

        setBlocks(resolved);
      } catch (e: any) {
        if (!active) return;
        setBlocks([]);
        setError(e?.message ?? "Failed to load landing");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadLanding();
    return () => {
      active = false;
    };
  }, [configPath, prefetchedBlocks]);

  const rendered = useMemo(
    () =>
      blocks.map((block, index) => {
        const key = block.id || `block-${index}`;
        const node = renderBlock(block, index, fallbackLocale);
        const anchorStyle = { scrollMarginTop: "176px" };
        if (isFullWidthBlock(block.type)) {
          return (
            <div key={`anchor-${key}`} id={key} className="w-full" style={anchorStyle}>
              {node}
            </div>
          );
        }
        return (
          <div key={`wrap-${key}`} id={key} className="w-full max-w-6xl px-4" style={anchorStyle}>
            {node}
          </div>
        );
      }),
    [blocks, fallbackLocale],
  );

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <main className="w-full">
        <div className="flex w-full flex-col items-center">
          {error ? (
            <div className="w-full max-w-6xl px-4 py-6">
              <h2 className="mb-3 text-2xl font-semibold text-red-400">Error</h2>
              <p className="text-slate-300">{error}</p>
            </div>
          ) : null}

          {!error && loading ? (
            <div className="w-full max-w-6xl px-4 py-6 text-slate-300">Loading...</div>
          ) : null}

          {!error && !loading ? rendered : null}
        </div>
      </main>
    </div>
  );
}

function isFullWidthBlock(type: string): boolean {
  return [
    "cnc-hero-request",
    "section-rail",
    "shop-proof",
    "certificates",
    "contacts-map",
  ].includes(type);
}

function renderBlock(block: ResolvedBlock, index: number, fallbackLocale: SupportedLocale) {
  const key = block.id || `block-${index}`;
  const lang = toStringOr(block.props.lang, fallbackLocale);

  switch (block.type) {
    case "hero-main": {
      const heroMain = block.data.heroMain as any;
      const texts = block.data.texts as any;
      return <HeroMain key={key} {...heroMain} texts={texts} lang={lang} />;
    }
    case "cnc-hero-request": {
      return (
        <HeroRequestBanner
          key={key}
          data={block.data.intake as HeroRequestBannerData}
          messageInputName="cnc_request_text"
        />
      );
    }
    case "section-rail": {
      return <LandingSectionRailBlock key={key} data={block.data.rail as LandingSectionRailBlockData} />;
    }
    case "ai-section": {
      const ui = block.data.ui as any;
      return <AISection key={key} content={ui?.aiSection} />;
    }
    case "video-block": {
      const video = block.data.video as any;
      const texts = block.data.texts as any;
      const heroMain = block.data.heroMain as any;
      return (
        <VideoBlock
          key={key}
          title={video?.title}
          blocks={video?.blocks}
          texts={texts}
          buttonText={heroMain?.buttonText}
          lang={lang}
          video_src={video?.video_src}
          isShorts={Boolean(block.props.isShorts)}
        />
      );
    }
    case "logos8": {
      return <Logos8 key={key} {...(block.data.logos as any)} />;
    }
    case "hero": {
      return <Hero key={key} data={block.data.heroPlatform as any} />;
    }
    case "feature": {
      const feature = block.data.feature as any;
      return (
        <Feature key={key} title={feature?.title} feature={feature?.items ?? []} />
      );
    }
    case "pricing2": {
      const pricing = block.data.pricing as any;
      return (
        <Pricing2
          key={key}
          plans={pricing?.plans}
          heading={pricing?.heading}
          description={pricing?.description}
          onJoin={() => void openLoginPanel()}
        />
      );
    }
    case "comparison-table": {
      return <ComparisonTable key={key} content={block.data.comparison as any} />;
    }
    case "stats": {
      return <Stats key={key} content={block.data.stats as any} />;
    }
    case "magic-cta": {
      const heroMain = block.data.heroMain as any;
      const stats = block.data.stats as any;
      const ui = block.data.ui as any;
      return (
        <MagicCTA
          key={key}
          title={heroMain?.heading}
          description={heroMain?.description}
          stats={stats?.stats ?? []}
          primaryText={ui?.nav?.solutions ?? "Solutions"}
          primaryHref={`/${lang}/solutions/`}
          secondaryText={ui?.nav?.product ?? "Product"}
          secondaryHref={`/${lang}/product/`}
        />
      );
    }
    case "shop-proof": {
      return <ShopProofBlock key={key} data={block.data.proof as ShopProofBlockData} />;
    }
    case "certificates": {
      return <CertificatesBlock key={key} data={block.data.certificates as CertificatesBlockData} />;
    }
    case "contacts-map": {
      return <ContactsMapBlock key={key} data={block.data.contacts as ContactMapBlockData} />;
    }
    default: {
      return (
        <div key={key} className="w-full py-4 text-amber-400">
          Unsupported block type: {block.type}
        </div>
      );
    }
  }
}

function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function ShopProofBlock({ data }: { data?: ShopProofBlockData }) {
  if (!data) return null;
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];

  return (
    <section className="cnc-info-block cnc-shop-proof">
      <div className="cnc-shop-proof__shell">
        <div className="cnc-shop-proof__copy">
          <h2>{data.title ?? "Shop proof"}</h2>
          {data.copy ? <p>{data.copy}</p> : null}
        </div>
        {metrics.length > 0 ? (
          <div className="cnc-shop-proof__metrics">
            {metrics.map((metric, index) => (
              <div className="cnc-shop-proof__metric" key={`${metric.label}-${index}`}>
                <strong>{metric.value}</strong>
                <p>{metric.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CertificatesBlock({ data }: { data?: CertificatesBlockData }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0) return null;

  return (
    <section className="cnc-info-block cnc-certificates">
      <div className="cnc-info-block__head">
        <h2>{data?.title ?? "Certificates"}</h2>
        {data?.subtitle ? <p>{data.subtitle}</p> : null}
      </div>
      <div className="cnc-certificates__grid">
        {items.map((item, index) => (
          <article className="cnc-certificate-card" key={item.id ?? `${item.title}-${index}`}>
            <h3>{item.title}</h3>
            <div className="cnc-certificate-card__sheet" aria-label={item.title}>
              {item.image ? (
                <img src={item.image} alt={item.title ?? ""} />
              ) : (
                <div className="cnc-certificate-card__mock">
                  <span>{item.standard ?? "CERTIFICATE"}</span>
                  <strong>{item.issuer ?? "Quality system"}</strong>
                  <i />
                  <i />
                  <i />
                  <b>{item.validUntil ?? "active"}</b>
                </div>
              )}
            </div>
            {item.description ? <p>{item.description}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ContactsMapBlock({ data }: { data?: ContactMapBlockData }) {
  if (!data) return null;
  const mapQuery = data.mapQuery || data.address || "Austin TX CNC machine shop";
  const mapSrc =
    data.mapEmbedUrl ||
    `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const phoneHref = data.phone ? `tel:${data.phone.replace(/[^\d+]/g, "")}` : undefined;

  return (
    <section className="cnc-info-block cnc-contacts-map">
      <div className="cnc-info-block__head">
        <h2>{data.title ?? "Contacts"}</h2>
        {data.subtitle ? <p>{data.subtitle}</p> : null}
      </div>
      <div className="cnc-contacts-map__layout">
        <aside className="cnc-contacts-map__details" aria-label="Shop contacts">
          {data.address ? (
            <div className="cnc-contacts-map__summary">
              <span>Shop location</span>
              <strong>{data.address}</strong>
            </div>
          ) : null}
          <div className="cnc-contacts-map__actions">
            {data.phone && phoneHref ? (
              <a href={phoneHref} className="cnc-contacts-map__action" data-variant="primary">
                <span>Call shop</span>
                <strong>{data.phone}</strong>
              </a>
            ) : null}
            {data.email ? (
              <a href={`mailto:${data.email}`} className="cnc-contacts-map__action">
                <span>Send drawing</span>
                <strong>{data.email}</strong>
              </a>
            ) : null}
          </div>
          {Array.isArray(data.hours) && data.hours.length > 0 ? (
            <div className="cnc-contacts-map__hours">
              <span>Hours</span>
              <div>
                {data.hours.map((line) => <p key={line}>{line}</p>)}
              </div>
            </div>
          ) : null}
        </aside>
        <div className="cnc-contacts-map__frame">
          <iframe
            title={data.title ?? "Contacts map"}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

