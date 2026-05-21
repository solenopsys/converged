import { useEffect, useMemo, useRef, useState } from "react";
import { createStructServiceClient } from "g-struct";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Paperclip,
  Ruler,
  SendHorizontal,
  Upload,
} from "lucide-react";
import {
  DEFAULT_LOCALE,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "front-core/landing-common/i18n";
import {
  LandingSectionRailBlock,
  type LandingSectionRailBlockData,
} from "front-core";
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
  return type === "cnc-hero-request" || type === "section-rail";
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

const DEFAULT_HERO_ACTIONS = [
  { icon: <BadgeCheck size={14} />, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: <Upload size={14} />, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: <CalendarClock size={14} />, label: "Estimate deadline", prompt: "Estimate deadline: " },
  { icon: <ClipboardCheck size={14} />, label: "Request quote", prompt: "Prepare a quote: " },
  { icon: <PackageCheck size={14} />, label: "Choose material", prompt: "Help me choose material: " },
  { icon: <Ruler size={14} />, label: "Check tolerances", prompt: "Check tolerances: " },
];

function CncHeroRequest({ data }: { data?: CncHeroRequestData }) {
  const request = data?.request ?? {};
  const contextName = request.contextName || "request";
  const placeholder =
    request.placeholder ||
    "Describe the part, material, quantity, tolerances, deadline and attach files in chat.";
  const submitLabel = request.submitLabel || "Start request";

  const chips = useMemo(() => {
    if (Array.isArray(request.chips) && request.chips.length > 0) {
      return request.chips.map((label, index) => {
        const fallback = DEFAULT_HERO_ACTIONS[index % DEFAULT_HERO_ACTIONS.length];
        return { icon: fallback.icon, label, prompt: `${label}: ` };
      });
    }
    return DEFAULT_HERO_ACTIONS;
  }, [request.chips]);

  const inputSlotRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const slot = inputSlotRef.current;
    if (!slot || typeof window === "undefined") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = slot.getBoundingClientRect().top;
      setDocked((wasDocked) => top <= (wasDocked ? 62 : 52));
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.heroInputDocked = docked ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.heroInputDocked;
    };
  }, [docked]);

  const setPrompt = (prompt: string) => {
    const el = textareaRef.current;
    if (!el) return;
    el.value = prompt;
    el.focus();
    try {
      el.setSelectionRange(prompt.length, prompt.length);
    } catch {
      // setSelectionRange may throw on certain input types
    }
  };

  return (
    <section id="request" className="hsl-root">
      <style>{heroScrollLayoutCss}</style>

      <div className="hsl-hero" aria-label="Hero">
        {data?.backgroundImage ? (
          <img className="hsl-hero-img" src={data.backgroundImage} alt="" aria-hidden="true" />
        ) : null}
        <div className="hsl-hero-overlay" aria-hidden="true" />
        <div className="hsl-hero-content">
          {data?.badge ? <div className="hsl-hero-badge">{data.badge}</div> : null}
          <h1 className="hsl-hero-title">
            <span>{data?.headline || "Precision CNC machining"}</span>
            {data?.highlight ? <span>{data.highlight}</span> : null}
          </h1>
          <p className="hsl-hero-copy">
            {data?.description ||
              "Send drawings, STEP/STL/DXF/PDF files or a plain text description. We collect the request details and prepare it for review."}
          </p>
        </div>
      </div>

      <div className="hsl-topbar-extension" aria-hidden="true" />

      <div ref={inputSlotRef} className="hsl-hero-input-slot">
        <div className={docked ? "hsl-hero-input hsl-hero-input--docked" : "hsl-hero-input"}>
          <div className="hsl-input-wrap">
            <form
              className="hsl-form"
              autoComplete="off"
              data-landing-event="chat.open"
              data-landing-context-name={contextName}
              data-landing-message-input='[name="cnc_request_text"]'
            >
              <textarea
                ref={textareaRef}
                name="cnc_request_text"
                aria-label="CNC request details"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                className="hsl-textarea"
                rows={1}
                wrap="off"
                placeholder={placeholder}
              />
              <button
                type="button"
                aria-label="Attach"
                className="hsl-attach"
                data-landing-event="chat.attach"
                data-landing-context-name={contextName}
              >
                <Paperclip size={15} />
              </button>
              <button type="submit" aria-label={submitLabel} className="hsl-send">
                <SendHorizontal size={15} />
              </button>
            </form>
            <div className="hsl-chips">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="hsl-chip"
                  data-hero-prompt={chip.prompt}
                  onClick={() => setPrompt(chip.prompt)}
                >
                  {chip.icon}
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const heroScrollLayoutCss = `
.hsl-root {
  --hsl-input-width: min(880px, calc(100vw - 40px));
  --hsl-topbar-height: 52px;
  width: 100%;
}

.hsl-hero {
  position: relative;
  min-height: 560px;
  height: clamp(560px, 72vh, 760px);
  display: grid;
  place-items: center;
  overflow: visible;
  background: #07101a;
}

.hsl-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 48%;
  filter: saturate(0.86) contrast(1.04) brightness(0.78);
}

.hsl-hero-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 18%, rgba(2,6,12,0.72) 100%),
    linear-gradient(180deg, rgba(2,6,12,0.42), rgba(2,6,12,0.74));
  pointer-events: none;
}

.hsl-hero-content {
  position: relative;
  width: min(1040px, calc(100% - 40px));
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 20px;
  padding: 40px 0 60px;
  transform: translateY(-72px);
}

.hsl-hero-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 252, 0.32);
  background: rgba(125, 211, 252, 0.12);
  color: #e0f2fe;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 4px 12px;
}

.hsl-hero-title {
  position: relative;
  z-index: 2;
  margin: 0;
  color: #f8fafc;
  font-size: clamp(44px, 7vw, 78px);
  font-weight: 800;
  letter-spacing: -0.065em;
  line-height: 0.98;
}

.hsl-hero-title span { display: block; }
.hsl-hero-title span + span { color: rgba(248,250,252,0.64); }

.hsl-hero-copy {
  position: relative;
  z-index: 2;
  width: min(620px, 100%);
  margin: 0;
  color: rgba(248,250,252,0.76);
  font-size: clamp(16px, 1.9vw, 20px);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.42;
}

.hsl-hero-input-slot {
  --hsl-input-lift: clamp(210px, 27vh, 300px);
  position: relative;
  z-index: 1300;
  width: var(--hsl-input-width);
  margin: calc(-1 * var(--hsl-input-lift)) auto calc(var(--hsl-input-lift) - 80px);
  min-height: 96px;
}

.hsl-hero-input {
  --hsl-input-ink: #f8fafc;
  --hsl-input-muted: rgba(248,250,252,0.68);
  --hsl-input-border: rgba(248,250,252,0.24);
  --hsl-input-surface: rgba(248,250,252,0.13);
  --hsl-input-surface-hover: rgba(248,250,252,0.2);
  --hsl-input-action-bg: #f8fafc;
  --hsl-input-action-ink: #07101a;
  width: 100%;
  opacity: 1;
  transition: filter 220ms ease, opacity 220ms ease;
}

/* Glass extension that visually merges the compact 52px topbar with the docked
   input + chips into one ~164px panel. Sits BEHIND the topbar
   (#ssr-control-panel-root z-index 1000) so the topbar's logo/menu/controls
   stay clickable on top of it; in front of normal page content. */
.hsl-topbar-extension {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 164px;
  z-index: 990;
  pointer-events: none;
  background: color-mix(in oklch, var(--ui-background) 74%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid color-mix(in oklch, var(--ui-foreground) 12%, transparent);
  box-shadow: 0 18px 42px rgba(0,0,0,0.18);
}

html[data-hero-input-docked="1"] .hsl-topbar-extension {
  display: block;
}

/* The compact topbar surface (and its outer container) becomes transparent
   so the glass extension behind it shows through across the full 164px area.
   Lives here (not in LandingTopBar.tsx) so dev-server reloads pick it up
   immediately when LandingView is rebuilt. */
html[data-hero-input-docked="1"] #ssr-control-panel-root {
  background: transparent !important;
  box-shadow: none !important;
  border-bottom-color: transparent !important;
}
html[data-hero-input-docked="1"] #ssr-control-panel-root .ltb,
html[data-hero-input-docked="1"] #ssr-control-panel-root .ltb--compact {
  background: transparent !important;
  border-bottom-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.hsl-hero-input--docked {
  position: fixed;
  top: 52px;
  left: max(20px, calc((100vw - 880px) / 2));
  right: max(20px, calc((100vw - 880px) / 2));
  z-index: 1300;
  width: auto;
  --hsl-input-ink: var(--ui-foreground);
  --hsl-input-muted: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
  --hsl-input-border: color-mix(in oklch, var(--ui-foreground) 18%, transparent);
  --hsl-input-surface: color-mix(in oklch, var(--ui-foreground) 6%, transparent);
  --hsl-input-surface-hover: color-mix(in oklch, var(--ui-foreground) 11%, transparent);
  --hsl-input-action-bg: var(--ui-foreground);
  --hsl-input-action-ink: var(--ui-background);
}

.hsl-input-wrap { display: grid; gap: 16px; }

.hsl-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 4px;
  height: 48px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  border: 1px solid var(--hsl-input-border);
  border-radius: 12px;
  background: var(--hsl-input-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 6px;
  box-sizing: border-box;
}

.hsl-textarea {
  resize: none;
  border: 0;
  background: transparent;
  color: var(--hsl-input-ink);
  font-size: 15px;
  line-height: 1.4;
  outline: none;
  overflow: hidden;
  padding: 6px 10px;
  font-family: inherit;
  white-space: nowrap;
}

.hsl-textarea::placeholder { color: var(--hsl-input-muted); }

.hsl-attach,
.hsl-send {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.hsl-attach {
  background: transparent;
  color: var(--hsl-input-muted);
}

.hsl-send {
  background: var(--hsl-input-action-bg);
  color: var(--hsl-input-action-ink);
}

.hsl-attach:hover {
  background: var(--hsl-input-surface-hover);
  color: var(--hsl-input-ink);
}

.hsl-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  justify-content: center;
  overflow: visible;
}

.hsl-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--hsl-input-border);
  border-radius: 999px;
  background: var(--hsl-input-surface);
  backdrop-filter: blur(8px);
  color: var(--hsl-input-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.hsl-chip:hover {
  background: var(--hsl-input-surface-hover);
  border-color: color-mix(in oklch, var(--hsl-input-ink) 34%, transparent);
}

@media (max-width: 960px) {
  .hsl-root { --hsl-input-width: calc(100vw - 28px); }
  .hsl-hero-input-slot { --hsl-input-lift: clamp(200px, 26vh, 250px); }
  .hsl-hero-input--docked {
    left: 14px;
    right: 14px;
  }
  .hsl-chips {
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .hsl-chips::-webkit-scrollbar { display: none; }
}
`;
