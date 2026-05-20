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
import {
  CapabilitiesRail,
  LandingSectionRailDemoStyles,
  MachinesRail,
  TeamRail,
} from "./landingSectionRailDemo";

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

const menuLinks = [
  { label: "Catalog", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Contacts", href: "#" },
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
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const inputSlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Dock only when the natural input position has reached the fixed position.
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const top = inputSlotRef.current?.getBoundingClientRect().top;
      if (top === undefined) return;
      setInputDocked((wasDocked) => top <= (wasDocked ? 62 : 52));
    };

    const scheduleMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleSubmit = (text: string) => {
    setValue("");
    alert(`Sending: ${text}`);
  };

  return (
    <div className="hsl-root">
      <style>{css}</style>

      {/* ── Fixed topbar ── */}
      <div className={inputDocked ? "hsl-topbar hsl-topbar--docked" : "hsl-topbar"}>
        <LandingTopBar
          logoLight="/landing/header-logo-black.svg"
          logoDark="/landing/header-logo-white.svg"
          actions={actions}
          menuLinks={menuLinks}
          languages={languages}
          currentLanguage="en"
          isDark={isDark}
          onThemeToggle={() => setIsDark((v) => !v)}
          onLogin={() => {}}
          compact
        />
      </div>

      {/* ── Hero banner ── */}
      <section className="hsl-hero" aria-label="Hero">
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

        </div>
      </section>

      {/* One input instance: it docks at the same coordinates, so there is no jump. */}
      <div ref={inputSlotRef} className="hsl-hero-input-slot">
        <div className={inputDocked ? "hsl-hero-input hsl-hero-input--docked" : "hsl-hero-input"}>
          <HeroInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            onAttach={() => {}}
          />
        </div>
      </div>

      {/* ── Scrollable content below hero ── */}
      <main className="rail-demo-page">
        <LandingSectionRailDemoStyles />
        <CapabilitiesRail />
        <MachinesRail />
        <TeamRail />
      </main>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const css = `
.hsl-root {
  --hsl-input-width: min(880px, calc(100vw - 40px));
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
  height: 52px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 80%, transparent);
  background: color-mix(in oklch, var(--ui-background) 82%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: height 320ms cubic-bezier(0.16, 1, 0.3, 1);
  overflow: visible;
}

/* Docked topbar height = 52 (topbar row, no extra gap so the menu has
   the same ~17px of breathing room above and below) + 48 (input) + 16
   (gap) + 32 (chips) + 16 (bottom gap) = 164 */
.hsl-topbar--docked {
  height: 164px;
  box-shadow: 0 14px 34px rgba(0,0,0,0.24);
}

.hsl-topbar .ltb--compact {
  position: relative;
  z-index: 1;
  background: transparent;
  border-bottom: 0;
  box-shadow: none;
}

/* ── Hero ── */
.hsl-hero {
  position: relative;
  margin-top: 52px;
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

/* ── Hero input slot ──
   Outer container is wider than the form so chips can flow naturally
   (their natural width ~775px) and don't visually slip into the form's
   block. min-height matches the docked stack: 48 + 16 + 32 = 96. */
.hsl-hero-input-slot {
  position: relative;
  z-index: 1300;
  width: var(--hsl-input-width);
  margin: -200px auto 120px;
  min-height: 96px;
}

.hsl-hero-input {
  width: 100%;
  opacity: 1;
  transition:
    filter 220ms ease,
    opacity 220ms ease;
}

.hsl-hero-input--docked {
  position: fixed;
  top: 52px;
  left: max(20px, calc((100vw - 880px) / 2));
  right: max(20px, calc((100vw - 880px) / 2));
  z-index: 1300;
  width: auto;
  filter: drop-shadow(0 16px 34px rgba(0,0,0,0.34));
}

/* ── Hero form ── */
.hsl-input-wrap { display: grid; gap: 16px; }

/* Form is intentionally narrower than the chips container so the two rows
   don't read as a single rectangular block. */
.hsl-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 4px;
  height: 48px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  border: 1px solid color-mix(in oklch, var(--ui-foreground) 20%, transparent);
  border-radius: 12px;
  background: color-mix(in oklch, var(--ui-foreground) 8%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 6px;
  box-sizing: border-box;
}

.hsl-textarea {
  resize: none;
  border: 0;
  background: transparent;
  color: var(--ui-foreground);
  font-size: 15px;
  line-height: 1.4;
  outline: none;
  padding: 6px 10px;
  font-family: inherit;
}

.hsl-textarea::placeholder { color: color-mix(in oklch, var(--ui-foreground) 54%, transparent); }

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
  color: color-mix(in oklch, var(--ui-foreground) 60%, transparent);
}

.hsl-send {
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.hsl-attach:hover {
  background: color-mix(in oklch, var(--ui-foreground) 10%, transparent);
  color: var(--ui-foreground);
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
  border: 1px solid color-mix(in oklch, var(--ui-foreground) 18%, transparent);
  border-radius: 999px;
  background: color-mix(in oklch, var(--ui-foreground) 4%, transparent);
  backdrop-filter: blur(8px);
  color: color-mix(in oklch, var(--ui-foreground) 86%, transparent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.hsl-chip:hover {
  background: color-mix(in oklch, var(--ui-foreground) 12%, transparent);
  border-color: color-mix(in oklch, var(--ui-foreground) 36%, transparent);
}

@media (max-width: 960px) {
  .hsl-root { --hsl-input-width: calc(100vw - 28px); }
  .hsl-topbar--docked { height: 164px; }
  .hsl-hero-input-slot {
    margin: -190px auto 100px;
  }
  .hsl-hero-input--docked {
    top: 52px;
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

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: "Prototypes/HeroScrollLayout",
  component: HeroScrollLayoutStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HeroScrollLayoutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
