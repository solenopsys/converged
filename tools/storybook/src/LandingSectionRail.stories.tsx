import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CapabilitiesRail,
  LandingSectionRailDemoStyles,
  MachinesRail,
  TeamRail,
} from "./landingSectionRailDemo";

function LandingSectionRailShowcase() {
  return (
    <main className="rail-demo-page">
      <LandingSectionRailDemoStyles />
      <CapabilitiesRail />
      <MachinesRail />
      <TeamRail />
    </main>
  );
}

const meta = {
  title: "Prototypes/LandingSectionRail",
  component: LandingSectionRailShowcase,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LandingSectionRailShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
