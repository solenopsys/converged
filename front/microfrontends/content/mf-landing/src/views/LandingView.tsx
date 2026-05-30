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
      <style>{landingInfoBlocksCss}</style>
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
      <style>{landingInfoBlocksCss}</style>
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
      <style>{landingInfoBlocksCss}</style>
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

const landingInfoBlocksCss = `
.cnc-info-block {
  --cnc-block-bg: var(--ui-background);
  --cnc-block-card: color-mix(in oklch, var(--ui-card) 92%, transparent);
  --cnc-block-line: color-mix(in oklch, var(--ui-foreground) 14%, transparent);
  --cnc-block-muted: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
  width: 100%;
  padding: 88px max(18px, calc((100vw - 1500px) / 2 + 18px));
  color: var(--ui-foreground);
}

.cnc-info-block__head {
  display: grid;
  gap: 18px;
  margin-bottom: 34px;
}

.cnc-info-block__head h2 {
  margin: 0;
  max-width: 920px;
  color: var(--ui-foreground);
  font-size: clamp(42px, 6vw, 82px);
  font-weight: 850;
  letter-spacing: -0.07em;
  line-height: 0.92;
}

.cnc-info-block__head p {
  margin: 0;
  max-width: 680px;
  color: var(--cnc-block-muted);
  font-size: 18px;
  line-height: 1.5;
}

.cnc-contacts-map .cnc-info-block__head h2 {
  max-width: 1120px;
  font-size: clamp(42px, 5vw, 72px);
}

.cnc-contacts-map .cnc-info-block__head p {
  max-width: 820px;
}

.cnc-shop-proof {
  padding-top: 36px;
  padding-bottom: 42px;
}

.cnc-shop-proof__shell {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(420px, 0.94fr);
  gap: 18px;
  align-items: stretch;
  padding: 22px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 28px;
  background:
    linear-gradient(135deg, color-mix(in oklch, var(--ui-foreground) 8%, transparent), transparent 36%),
    color-mix(in oklch, var(--ui-card) 90%, var(--ui-background));
}

.cnc-shop-proof__copy {
  display: grid;
  align-content: center;
  gap: 18px;
  min-height: 310px;
  padding: 28px;
}

.cnc-shop-proof__copy span {
  width: fit-content;
  padding: 8px 11px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 999px;
  color: var(--cnc-block-muted);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
}

.cnc-shop-proof__copy h2,
.cnc-shop-proof__copy p {
  margin: 0;
}

.cnc-shop-proof__copy h2 {
  max-width: 780px;
  color: var(--ui-foreground);
  font-size: clamp(44px, 5.6vw, 78px);
  font-weight: 880;
  letter-spacing: -0.075em;
  line-height: 0.9;
}

.cnc-shop-proof__copy p {
  max-width: 650px;
  color: var(--cnc-block-muted);
  font-size: 18px;
  line-height: 1.48;
}

.cnc-shop-proof__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.cnc-shop-proof__metric {
  min-height: 150px;
  display: grid;
  align-content: space-between;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 22px;
  background: color-mix(in oklch, var(--ui-card) 78%, transparent);
}

.cnc-shop-proof__metric strong {
  color: var(--ui-foreground);
  font-size: clamp(36px, 4vw, 58px);
  font-weight: 880;
  letter-spacing: -0.07em;
  line-height: 0.9;
}

.cnc-shop-proof__metric p {
  margin: 0;
  color: var(--cnc-block-muted);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.34;
}

.cnc-shop-proof__points {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cnc-shop-proof__points li {
  padding: 10px 13px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 999px;
  color: var(--ui-foreground);
  background: color-mix(in oklch, var(--ui-card) 76%, transparent);
  font-size: 13px;
  font-weight: 720;
}

.cnc-certificates__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.cnc-certificate-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 18px;
  background: var(--cnc-block-card);
}

.cnc-certificate-card h3 {
  margin: 0;
  grid-column: 1 / -1;
  color: var(--ui-foreground);
  font-size: 18px;
  font-weight: 780;
  letter-spacing: -0.035em;
  line-height: 1.12;
}

.cnc-certificate-card__sheet {
  width: 64px;
  aspect-ratio: 0.707 / 1;
  overflow: hidden;
  border: 1px solid color-mix(in oklch, var(--ui-foreground) 18%, transparent);
  border-radius: 6px;
  background: #f7f3ea;
  box-shadow: 0 8px 18px rgba(0,0,0,0.14);
}

.cnc-certificate-card__sheet img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cnc-certificate-card__mock {
  height: 100%;
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 12% 11%;
  color: #171717;
  background:
    linear-gradient(90deg, transparent 0 7%, rgba(0,0,0,0.08) 7% 7.4%, transparent 7.4%),
    #f7f3ea;
}

.cnc-certificate-card__mock span {
  color: #6b6b5f;
  font-size: 5px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.cnc-certificate-card__mock strong {
  max-width: 9ch;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: -0.07em;
  line-height: 0.92;
}

.cnc-certificate-card__mock i {
  display: block;
  height: 3px;
  border-radius: 999px;
  background: rgba(0,0,0,0.1);
}

.cnc-certificate-card__mock i:nth-of-type(2) { width: 72%; }
.cnc-certificate-card__mock i:nth-of-type(3) { width: 52%; }

.cnc-certificate-card__mock b {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  margin-top: auto;
  border: 1px solid rgba(0,0,0,0.26);
  border-radius: 999px;
  color: rgba(0,0,0,0.62);
  font-size: 4px;
  font-weight: 800;
  text-transform: uppercase;
}

.cnc-certificate-card p {
  margin: 0;
  align-self: start;
  color: var(--cnc-block-muted);
  font-size: 13px;
  line-height: 1.42;
}

.cnc-contacts-map__layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.74fr) minmax(0, 1.26fr);
  gap: 18px;
  align-items: stretch;
}

.cnc-contacts-map__details {
  min-height: 460px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 24px;
  background:
    radial-gradient(circle at 10% 0%, color-mix(in oklch, var(--ui-foreground) 8%, transparent), transparent 34%),
    color-mix(in oklch, var(--ui-card) 94%, var(--ui-background));
}

.cnc-contacts-map__summary {
  display: grid;
  gap: 10px;
  padding: 18px 18px 4px;
}

.cnc-contacts-map__details span {
  color: var(--cnc-block-muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.cnc-contacts-map__summary strong {
  margin: 0;
  color: var(--ui-foreground);
  font-size: clamp(30px, 3vw, 42px);
  font-weight: 830;
  letter-spacing: -0.055em;
  line-height: 0.98;
}

.cnc-contacts-map__actions {
  display: grid;
  gap: 10px;
}

.cnc-contacts-map__action {
  display: grid;
  gap: 5px;
  padding: 16px 18px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 18px;
  color: var(--ui-foreground);
  text-decoration: none;
  background: color-mix(in oklch, var(--ui-card) 86%, transparent);
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.cnc-contacts-map__action[data-variant="primary"] {
  border-color: var(--ui-foreground);
  color: var(--ui-background);
  background: var(--ui-foreground);
}

.cnc-contacts-map__action:hover {
  border-color: color-mix(in oklch, var(--ui-foreground) 44%, transparent);
}

.cnc-contacts-map__action span {
  color: currentColor;
  opacity: 0.62;
}

.cnc-contacts-map__action strong {
  color: currentColor;
  font-size: 18px;
  font-weight: 760;
  line-height: 1.16;
}

.cnc-contacts-map__hours {
  display: grid;
  gap: 12px;
  margin-top: auto;
  padding: 18px;
}

.cnc-contacts-map__hours div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cnc-contacts-map__hours p {
  margin: 0;
  padding: 8px 11px;
  border: 1px solid var(--cnc-block-line);
  border-radius: 999px;
  color: var(--ui-foreground);
  background: color-mix(in oklch, var(--ui-card) 80%, transparent);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
}

.cnc-contacts-map__frame {
  min-height: 460px;
  overflow: hidden;
  border: 1px solid var(--cnc-block-line);
  border-radius: 24px;
  background: var(--cnc-block-card);
}

.cnc-contacts-map__frame iframe {
  width: 100%;
  height: 100%;
  min-height: 460px;
  border: 0;
  filter: grayscale(0.86) contrast(1.04);
}

@media (max-width: 900px) {
  .cnc-info-block { padding: 58px 18px; }
  .cnc-certificates__grid,
  .cnc-shop-proof__shell,
  .cnc-contacts-map__layout {
    grid-template-columns: 1fr;
  }
  .cnc-shop-proof__metrics {
    grid-template-columns: 1fr;
  }
}
`;
