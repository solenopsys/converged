import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Ruler,
  Upload,
} from "lucide-react";
import React, { useState } from "react";
import { LandingTopBar } from "front-core";

const actions = [
  { icon: <BadgeCheck size={14} />, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: <Upload size={14} />, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: <CalendarClock size={14} />, label: "Estimate deadline", prompt: "Estimate deadline for this request: " },
  { icon: <ClipboardCheck size={14} />, label: "Request quote", prompt: "Prepare a quote for this request: " },
  { icon: <PackageCheck size={14} />, label: "Choose material", prompt: "Help me choose material for this part: " },
  { icon: <Ruler size={14} />, label: "Check tolerances", prompt: "Check tolerances for this part: " },
];

const languages = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

function WithTheme({ args }: { args: React.ComponentProps<typeof LandingTopBar> }) {
  const [isDark, setIsDark] = useState(false);
  return (
    <div
      className={isDark ? "dark" : ""}
      style={{ minHeight: "100vh", background: "var(--ui-background)" }}
    >
      <LandingTopBar
        {...args}
        isDark={isDark}
        onThemeToggle={() => {
          setIsDark((v) => !v);
          document.documentElement.classList.toggle("dark");
        }}
      />
    </div>
  );
}

const meta = {
  title: "Prototypes/LandingTopBar",
  component: LandingTopBar,
  parameters: { layout: "fullscreen" },
  render: (args) => <WithTheme args={args} />,
} satisfies Meta<typeof LandingTopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  globals: { theme: "light" },
  args: {
    logoLight: "/landing/header-logo-black.svg",
    logoDark: "/landing/header-logo-white.svg",
    phone: "+7 (800) 555-35-35",
    statusText: "OPEN · UNTIL 18:00",
    actions,
    languages,
    currentLanguage: "en",
    onLogin: () => alert("login"),
  },
};

export const Dark: Story = {
  globals: { theme: "dark" },
  args: {
    ...Light.args,
  },
};
