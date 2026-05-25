import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  PackageCheck,
  Upload,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { ConvergedRailPanel, ConvergedRailControls } from "front-core";

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

const languages = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

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
          composerValue={composerValue}
          onComposerChange={setComposerValue}
          onComposerSubmit={() => setComposerValue("")}
          composerPlaceholder="Describe your CNC request..."
          controls={<ConvergedRailControls languages={languages} />}
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
