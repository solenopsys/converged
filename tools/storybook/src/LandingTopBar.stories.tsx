import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { LandingTopBarIntegration } from "front-core";
import { seedControlPanel } from "./seedControlPanel";

function TopBarStory({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => { seedControlPanel({ theme }); }, [theme]);
  return (
    <div style={{ minHeight: "100vh", background: "var(--ui-background)" }}>
      <LandingTopBarIntegration />
    </div>
  );
}

const meta = {
  title: "Landing/TopBar",
  component: TopBarStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TopBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
};

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
};
