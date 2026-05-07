import { useEffect, useMemo, useState } from "react";
import { createStructServiceClient } from "g-struct";
import { Paperclip, SendHorizontal } from "lucide-react";
import {
  DEFAULT_LOCALE,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "front-core/landing-common/i18n";
import { openLoginPanel } from "front-core/landing-common/island-client";
import {
  AISection,
  ComparisonTable,
  Faq,
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
type LandingPrefetchPayload = {
  configPath: string;
  blocks: ResolvedBlock[];
};

type CncHeroRequestData = {
  badge?: string;
  brand?: string;
  nav?: string[];
  headline?: string;
  highlight?: string;
  description?: string;
  backgroundImage?: string;
  primaryAction?: string;
  secondaryAction?: string;
  request?: {
    title?: string;
    description?: string;
    placeholder?: string;
    submitLabel?: string;
    attachLabel?: string;
    contextName?: string;
    chips?: string[];
  };
  metrics?: Array<{ value: string; label: string }>;
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
        if (isFullWidthBlock(block.type)) return node;
        return (
          <div key={`wrap-${key}`} className="w-full max-w-6xl px-4">
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
  return type === "cnc-hero-request";
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
      return <CncHeroRequest key={key} data={block.data.intake as CncHeroRequestData} />;
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
    case "faq": {
      const faq = block.data.faq as any;
      return <Faq key={key} faqs={faq?.faqs ?? []} title={faq?.title ?? "FAQ"} />;
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

function CncHeroRequest({ data }: { data?: CncHeroRequestData }) {
  const request = data?.request ?? {};
  const contextName = request.contextName || "request";
  const placeholder =
    request.placeholder ||
    "Describe the part, material, quantity, tolerances, deadline and attach files in chat.";
  const submitLabel = request.submitLabel || "Start request";

  return (
    <section id="request" className="w-full py-0">
      <div
        className="relative min-h-[620px] overflow-hidden bg-slate-950 text-white shadow-2xl"
        style={{
          background: data?.backgroundImage
            ? `linear-gradient(180deg, rgba(2, 6, 23, 0.62) 0%, rgba(2, 6, 23, 0.74) 42%, rgba(2, 6, 23, 0.96) 100%), url(${data.backgroundImage}) center / cover no-repeat`
            : "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="relative z-10 flex min-h-[620px] flex-col px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <div className="mx-auto max-w-4xl">
              {data?.badge ? (
                <div className="mb-5 inline-flex items-center rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-100">
                  {data.badge}
                </div>
              ) : null}
              <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                {data?.headline || "Precision CNC machining"}
                {data?.highlight ? (
                  <>
                    <br />
                    <span className="text-slate-300">{data.highlight}</span>
                  </>
                ) : null}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {data?.description ||
                  "Send drawings, STEP/STL/DXF/PDF files or a plain text description. We collect the request details and prepare it for review."}
              </p>
            </div>

            <form
              className="mt-8 w-full max-w-3xl rounded-lg text-left shadow-2xl"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                boxShadow: "0 28px 80px rgba(2, 6, 23, 0.34)",
              }}
              autoComplete="off"
              data-landing-event="chat.open"
              data-landing-context-name={contextName}
              data-landing-message-input='[name="cnc_request_text"]'
            >
              <div className="flex items-end gap-3 p-3">
                <button
                  type="button"
                  aria-label="Attach file"
                  className="mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:opacity-80"
                  style={{ color: "#475569" }}
                  data-landing-event="chat.attach"
                  data-landing-context-name={contextName}
                >
                  <Paperclip size={18} strokeWidth={1.8} />
                </button>
                <textarea
                  name="cnc_request_text"
                  aria-label="CNC request details"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  className="block min-h-14 flex-1 resize-none border-0 px-1 py-3 text-base leading-7 outline-none"
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                  }}
                  placeholder={placeholder}
                />
                <button
                  type="submit"
                  aria-label={submitLabel}
                  className="mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:opacity-90"
                  style={{
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.22)",
                  }}
                >
                  <SendHorizontal size={17} strokeWidth={2} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
