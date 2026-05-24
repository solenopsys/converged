import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Columns2,
  Globe2,
  LogIn,
  MessageSquare,
  PackageCheck,
  PanelLeftClose,
  Sun,
  Upload,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { ConvergedRailPanel, Button } from "front-core";

const screens = [
  { id: "feed", label: "Feed", icon: <Activity size={18} /> },
  { id: "orders", label: "Orders", icon: <PackageCheck size={18} /> },
  { id: "ivanov", label: "Ivanov", detail: "turning", icon: <Wrench size={18} /> },
];

const quickActions = [
  { id: "check", label: "Check drawing", prompt: "Check the drawing for the open order.", icon: <BadgeCheck size={16} /> },
  { id: "upload", label: "Upload file", prompt: "Prepare a file upload for the current order.", icon: <Upload size={16} /> },
  { id: "deadline", label: "Estimate deadline", prompt: "Estimate the deadline for the current order.", icon: <CalendarClock size={16} /> },
];

// Та же структура chatSlot что в control-panel-runtime.tsx + глобальный CSS из ssr-shell.tsx
const chatSlot = (
  <>
    <style>{`
      /* CSS из control-panel-runtime.tsx */
      .cp-slots { min-height: 0; height: 100%; display: flex; flex-direction: column; }
      .cp-tab-slot, .cp-chat-slot { min-height: 0; min-width: 0; }
      .cp-tab-slot:empty { display: none; }
      .cp-chat-slot { flex: 1 1 auto; display: flex; flex-direction: column; }
      .cp-chat-slot > * { flex: 1 1 auto; min-height: 0; }
      /* CSS из ssr-shell.tsx — применяется глобально в реальном приложении */
      #slot-panel-chat, #slot-panel-tab { min-height: 100%; min-width: 0; }
      .ssr-right-rail-empty { display: flex; flex-direction: column; gap: 14px; padding: 20px 18px; }
      .ssr-right-rail-empty h3 { margin: 0; font-size: 30px; line-height: 1.08; }
      .ssr-right-rail-empty p { margin: 0; opacity: 0.72; }
    `}</style>
    <div className="cp-slots">
      <div id="slot-panel-tab" className="cp-tab-slot"><span /></div>{/* non-empty like in production when mf-requests mounts */}
      <div id="slot-panel-chat" className="cp-chat-slot">
        <div className="ssr-right-rail-empty">
          <h3>AI Assistant</h3>
          <p>Loading…</p>
        </div>
      </div>
    </div>
  </>
);

function RailControls() {
  const [langOpen, setLangOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Login">
        <LogIn size={17} />
      </Button>
      <Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Theme">
        <Sun size={17} />
      </Button>
      <div className="ssr-lang-control" data-open={langOpen ? "1" : "0"} data-ssr-lang-root="">
        <Button
          aria-expanded={langOpen}
          aria-label="Language"
          className="ssr-panel-control ssr-lang-trigger"
          onClick={() => setLangOpen((v) => !v)}
          size="sm"
          variant="ghost"
          type="button"
        >
          <Globe2 size={16} />
          <span className="ssr-lang-current">EN</span>
        </Button>
        <div className="ssr-lang-popover" role="menu">
          <button className="ssr-lang-option is-active" type="button">EN</button>
          <button className="ssr-lang-option" type="button">RU</button>
        </div>
      </div>
      <Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Collapse">
        <PanelLeftClose size={17} />
      </Button>
      <Button className="ssr-right-rail-tab-btn" size="icon" variant="ghost" type="button" aria-label="AI panel" aria-pressed="true">
        <MessageSquare size={17} />
      </Button>
      <Button className="ssr-right-rail-tab-btn" size="icon" variant="ghost" type="button" aria-label="Form panel" aria-pressed="false">
        <Columns2 size={17} />
      </Button>
    </div>
  );
}

function PanelStory() {
  const [activeScreen, setActiveScreen] = useState(screens[0]?.id ?? "");
  const [openScreens, setOpenScreens] = useState(screens);
  const [composerValue, setComposerValue] = useState("");

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ui-background)" }}>
      <div style={{
        width: 360,
        flexShrink: 0,
        height: "100%",
        borderRight: "1px solid color-mix(in oklch, var(--ui-border) 74%, transparent)",
        overflow: "hidden",
      }}>
        <ConvergedRailPanel
          logoLight="/landing/header-logo-black.svg"
          logoDark="/landing/header-logo-white.svg"
          screens={openScreens}
          activeScreenId={activeScreen}
          onScreenChange={setActiveScreen}
          onScreenClose={(id) => setOpenScreens((s) => s.filter((sc) => sc.id !== id))}
          quickActions={quickActions}
          onQuickAction={setComposerValue}
          chatSlot={chatSlot}
          composerValue={composerValue}
          onComposerChange={setComposerValue}
          onComposerSubmit={() => setComposerValue("")}
          composerPlaceholder="Describe your CNC request..."
          controls={<RailControls />}
        />
      </div>
      <div style={{ flex: 1, padding: 24, color: "var(--ui-muted-foreground)", fontSize: 14 }}>
        Main content area
      </div>
    </div>
  );
}

const meta = {
  title: "App/ControlPanel",
  component: PanelStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = { globals: { theme: "dark" } };
export const Light: Story = { globals: { theme: "light" } };
