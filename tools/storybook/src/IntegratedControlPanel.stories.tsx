import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Columns2,
  Globe2,
  LogIn,
  MessageSquare,
  PackageCheck,
  PanelLeftClose,
  Ruler,
  Sun,
  Upload,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useUnit } from "effector-react";
import {
  $layoutMode,
  setLayoutMode,
  LandingTopBar,
  ConvergedRailPanel,
  type RailScreen,
  type RailQuickAction,
} from "front-core";
import { Button } from "front-core";

// ── Data ──────────────────────────────────────────────────────────────────────

const topBarActions = [
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

const initialScreens: RailScreen[] = [
  { id: "feed", label: "Feed", icon: <Activity size={18} /> },
  { id: "orders", label: "Orders", icon: <PackageCheck size={18} /> },
  { id: "ivanov", label: "Ivanov", detail: "turning", icon: <Wrench size={18} /> },
];

const railQuickActions: RailQuickAction[] = [
  { id: "check", label: "Check drawing", prompt: "Check the drawing for the open order.", icon: <BadgeCheck size={16} /> },
  { id: "upload", label: "Upload file", prompt: "Prepare a file upload for the current order.", icon: <Upload size={16} /> },
  { id: "deadline", label: "Estimate deadline", prompt: "Estimate the deadline for the current order.", icon: <CalendarClock size={16} /> },
];

// ── Integration controller ────────────────────────────────────────────────────

function IntegratedControlPanel() {
  const layoutMode = useUnit($layoutMode);
  const setMode = useUnit(setLayoutMode);
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState("en");
  const [topbarValue, setTopbarValue] = useState("");
  const [screens, setScreens] = useState(initialScreens);
  const [activeScreen, setActiveScreen] = useState(initialScreens[0]?.id ?? "");
  const [composerValue, setComposerValue] = useState("");

  const handleTheme = () => {
    setIsDark((v) => !v);
    document.documentElement.classList.toggle("dark");
  };

  const handleTopbarSubmit = (text: string) => {
    setTopbarValue("");
    setMode("app");
    setComposerValue(text);
  };

  const handleComposerSubmit = () => {
    setComposerValue("");
  };

  const railControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Login">
        <LogIn size={17} />
      </Button>
      <Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Theme" onClick={handleTheme}>
        <Sun size={17} />
      </Button>
      <Button className="ssr-panel-control ssr-lang-trigger" size="sm" variant="ghost" type="button" aria-label="Language">
        <Globe2 size={16} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>{lang.toUpperCase()}</span>
      </Button>
      <Button
        className="ssr-panel-control"
        size="icon"
        variant="ghost"
        type="button"
        aria-label="Back to landing"
        onClick={() => setMode("landing")}
      >
        <PanelLeftClose size={17} />
      </Button>
      <Button className="ssr-right-rail-tab-btn" size="icon" variant="ghost" type="button" aria-label="Chat" aria-pressed="true">
        <MessageSquare size={17} />
      </Button>
      <Button className="ssr-right-rail-tab-btn" size="icon" variant="ghost" type="button" aria-label="Panels" aria-pressed="false">
        <Columns2 size={17} />
      </Button>
    </div>
  );

  return (
    <div
      className={isDark ? "dark" : ""}
      style={{
        minHeight: "100vh",
        background: "var(--ui-background)",
        color: "var(--ui-foreground)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {layoutMode === "landing" ? (
        <LandingTopBar
          logoLight="/landing/header-logo-black.svg"
          logoDark="/landing/header-logo-white.svg"
          phone="+7 (800) 555-35-35"
          statusText="OPEN · UNTIL 18:00"
          actions={topBarActions}
          languages={languages}
          currentLanguage={lang}
          isDark={isDark}
          onThemeToggle={handleTheme}
          onLanguage={setLang}
          onLogin={() => {}}
          value={topbarValue}
          onValueChange={setTopbarValue}
          onSubmit={handleTopbarSubmit}
        />
      ) : (
        <div style={{ display: "flex", height: "100vh" }}>
          <div style={{ width: 360, flexShrink: 0, height: "100%", borderRight: "1px solid var(--ui-border)" }}>
            <ConvergedRailPanel
              logoLight="/landing/header-logo-black.svg"
              logoDark="/landing/header-logo-white.svg"
              screens={screens}
              activeScreenId={activeScreen}
              onScreenChange={setActiveScreen}
              onScreenClose={(id) => setScreens((s) => s.filter((sc) => sc.id !== id))}
              quickActions={railQuickActions}
              onQuickAction={setComposerValue}
              composerValue={composerValue}
              onComposerChange={setComposerValue}
              onComposerSubmit={handleComposerSubmit}
              composerPlaceholder="Describe your CNC request..."
              controls={railControls}
            />
          </div>
          <div style={{ flex: 1, padding: 32, overflow: "auto" }}>
            <p style={{ color: "var(--ui-muted-foreground)", fontSize: 14 }}>
              Content area — sidebar active
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: "Integration/IntegratedControlPanel",
  component: IntegratedControlPanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IntegratedControlPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
