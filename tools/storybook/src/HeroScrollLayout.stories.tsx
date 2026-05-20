import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Paperclip,
  Ruler,
  Send,
  Upload,
} from "lucide-react";
import { LandingTopBar } from "front-core";
import workshopImage from "../../../../../images/workshop.png";

const actions = [
  { icon: <BadgeCheck size={14} />, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: <Upload size={14} />, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: <CalendarClock size={14} />, label: "Estimate deadline", prompt: "Estimate deadline: " },
  { icon: <ClipboardCheck size={14} />, label: "Request quote", prompt: "Prepare a quote: " },
  { icon: <PackageCheck size={14} />, label: "Choose material", prompt: "Help me choose material: " },
  { icon: <Ruler size={14} />, label: "Check tolerances", prompt: "Check tolerances: " },
];

const languages = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

// ── Hero input (standalone, lives inside the banner) ─────────────────────────

function HeroInput({
  value,
  onChange,
  onSubmit,
  onAttach,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onAttach: () => void;
}) {
  return (
    <div className="hsl-input-wrap">
      <form
        className="hsl-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <textarea
          className="hsl-textarea"
          rows={1}
          placeholder="ask anything..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) onSubmit(value.trim());
            }
          }}
        />
        <button className="hsl-attach" type="button" aria-label="Attach" onClick={onAttach}>
          <Paperclip size={15} />
        </button>
        <button className="hsl-send" type="submit" aria-label="Send">
          <Send size={15} />
        </button>
      </form>
      <div className="hsl-chips">
        {actions.map((a) => (
          <button key={a.label} className="hsl-chip" type="button" onClick={() => onChange(a.prompt)}>
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Combined story component ──────────────────────────────────────────────────

function HeroScrollLayoutStory() {
  const [value, setValue] = useState("");
  const [inputDocked, setInputDocked] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Watch when the hero input scrolls out of view → dock to topbar
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInputDocked(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = (text: string) => {
    setValue("");
    alert(`Sending: ${text}`);
  };

  const topbarHeight = inputDocked ? 116 : 52;

  return (
    <div className={isDark ? "hsl-root dark" : "hsl-root"}>
      <style>{css}</style>

      {/* ── Fixed topbar ── */}
      <div className="hsl-topbar" style={{ height: topbarHeight }}>
        <LandingTopBar
          logoLight="/landing/header-logo-black.svg"
          logoDark="/landing/header-logo-white.svg"
          actions={actions}
          languages={languages}
          currentLanguage="en"
          isDark={isDark}
          onThemeToggle={() => setIsDark((v) => !v)}
          onLogin={() => {}}
          compact={!inputDocked}
          value={inputDocked ? value : ""}
          onValueChange={inputDocked ? setValue : undefined}
          onSubmit={inputDocked ? handleSubmit : undefined}
        />
      </div>

      {/* ── Hero banner ── */}
      <section
        className="hsl-hero"
        style={{ marginTop: topbarHeight }}
        aria-label="Hero"
      >
        <img className="hsl-hero-img" src={workshopImage} alt="" aria-hidden="true" />
        <div className="hsl-hero-overlay" aria-hidden="true" />
        <div className="hsl-hero-content">
          <h1 className="hsl-hero-title">
            <span>ask anything.</span>
            <span>attach everything.</span>
          </h1>
          <p className="hsl-hero-copy">
            One chat surface, every model, your files in context.
            Drop a PDF, paste a screenshot, or just start typing.
          </p>

          {/* Input lives here — hidden when docked to topbar */}
          <div
            className={inputDocked ? "hsl-hero-input hsl-hero-input--hidden" : "hsl-hero-input"}
            aria-hidden={inputDocked}
          >
            <HeroInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              onAttach={() => {}}
            />
          </div>

          {/* Sentinel — when this exits viewport, input docks */}
          <div ref={sentinelRef} className="hsl-sentinel" aria-hidden="true" />
        </div>
      </section>

      {/* ── Scrollable content below hero ── */}
      <div className="hsl-content">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="hsl-content-block">
            <h2>Section {i + 1}</h2>
            <p>Scroll down to see the AI input dock to the topbar.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const css = `
.hsl-root {
  background: var(--ui-background);
  color: var(--ui-foreground);
  min-height: 100vh;
}

/* ── Topbar ── */
.hsl-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: height 320ms cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

/* ── Hero ── */
.hsl-hero {
  position: relative;
  min-height: 560px;
  height: clamp(560px, 72vh, 760px);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #07101a;
  transition: margin-top 320ms cubic-bezier(0.16, 1, 0.3, 1);
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
  z-index: 1;
  width: min(860px, calc(100% - 40px));
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 20px;
  padding: 40px 0 60px;
}

.hsl-hero-title {
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
  width: min(620px, 100%);
  margin: 0;
  color: rgba(248,250,252,0.76);
  font-size: clamp(16px, 1.9vw, 20px);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.42;
}

/* ── Hero input ── */
.hsl-hero-input {
  width: min(640px, 100%);
  opacity: 1;
  transform: translateY(0);
  transition: opacity 240ms ease, transform 240ms ease;
}

.hsl-hero-input--hidden {
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
}

.hsl-sentinel {
  height: 1px;
  width: 100%;
}

/* ── Hero form ── */
.hsl-input-wrap { display: grid; gap: 12px; }

.hsl-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 6px;
  min-height: 52px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 14px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 6px 6px 6px 18px;
  box-sizing: border-box;
}

.hsl-textarea {
  resize: none;
  border: 0;
  background: transparent;
  color: #f8fafc;
  font-size: 16px;
  line-height: 1.4;
  outline: none;
  padding: 4px 0;
  font-family: inherit;
}

.hsl-textarea::placeholder { color: rgba(248,250,252,0.54); }

.hsl-attach {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgba(248,250,252,0.6);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hsl-send {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: #f8fafc;
  color: #07101a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hsl-attach:hover { background: rgba(255,255,255,0.1); color: #f8fafc; }

.hsl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.hsl-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(248,250,252,0.28);
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(8px);
  color: rgba(248,250,252,0.88);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.hsl-chip:hover { background: rgba(255,255,255,0.14); border-color: rgba(248,250,252,0.48); }

/* ── Scrollable content ── */
.hsl-content { padding: 60px 40px; max-width: 860px; margin: 0 auto; }
.hsl-content-block {
  padding: 40px 0;
  border-bottom: 1px solid var(--ui-border);
}
.hsl-content-block h2 {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
}
.hsl-content-block p {
  margin: 0;
  color: var(--ui-muted-foreground);
}
`;

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: "Prototypes/HeroScrollLayout",
  component: HeroScrollLayoutStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HeroScrollLayoutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
