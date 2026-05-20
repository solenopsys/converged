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
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--ui-background)", padding: 24 }}>
      <div style={{ width: "min(calc(100vw - 48px), 360px)", height: 820, border: "1px solid color-mix(in oklch, var(--ui-border) 74%, transparent)", overflow: "hidden" }}>
        <ConvergedRailPanel
          logoLight="/landing/header-logo-black.svg"
          logoDark="/landing/header-logo-white.svg"
          screens={openScreens}
          activeScreenId={activeScreen}
          onScreenChange={setActiveScreen}
          onScreenClose={(id) => setOpenScreens((s) => s.filter((sc) => sc.id !== id))}
          quickActions={quickActions}
          onQuickAction={setComposerValue}
          composerValue={composerValue}
          onComposerChange={setComposerValue}
          onComposerSubmit={() => setComposerValue("")}
          composerPlaceholder="Describe your CNC request..."
          controls={<RailControls />}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Prototypes/ConvergedRightRailPanel",
  component: PanelStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = { globals: { theme: "dark" } };
export const Light: Story = { globals: { theme: "light" } };
