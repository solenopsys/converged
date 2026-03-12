import { useEffect, useMemo, useState } from "react";
import { createStructServiceClient } from "g-struct";
import {
  AISection,
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

export default function LandingView({ configPath }: { configPath: string }) {
  const prefetchedBlocks = useMemo(() => getPrefetchedBlocks(configPath), [configPath]);
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

    const loadLanding = async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = (await structClient.readJson(configPath)) as LandingConfig;
        if (!active) return;

        const baseBlocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
        const sourcePaths = Array.from(
          new Set(
            baseBlocks.flatMap((block) =>
              Object.values(block.sources ?? {}).filter(
                (value): value is string =>
                  typeof value === "string" && value.length > 0,
              ),
            ),
          ),
        );

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
            data[alias] = sourceMap.get(path);
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
    () => blocks.map((block, index) => renderBlock(block, index)),
    [blocks],
  );

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <main className="mx-auto px-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          {error ? (
            <div className="w-full py-6">
              <h2 className="mb-3 text-2xl font-semibold text-red-400">Error</h2>
              <p className="text-slate-300">{error}</p>
            </div>
          ) : null}

          {!error && loading ? (
            <div className="w-full py-6 text-slate-300">Loading...</div>
          ) : null}

          {!error && !loading ? rendered : null}
        </div>
      </main>
    </div>
  );
}

function renderBlock(block: ResolvedBlock, index: number) {
  const key = block.id || `block-${index}`;
  const lang = toStringOr(block.props.lang, "ru");

  switch (block.type) {
    case "hero-main": {
      const heroMain = block.data.heroMain as any;
      const texts = block.data.texts as any;
      return <HeroMain key={key} {...heroMain} texts={texts} lang={lang} />;
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
        />
      );
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
