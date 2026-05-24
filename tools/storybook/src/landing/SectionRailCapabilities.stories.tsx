import type { Meta, StoryObj } from "@storybook/react-vite";
import { LandingSectionRailBlock } from "front-core";
import { withIslands } from "../ssr/withIslands";
import { capabilitiesRail } from "../landingSectionRailDemo";

const meta = {
  title: "Landing/SectionRail/Capabilities",
  component: LandingSectionRailBlock,
  parameters: { layout: "fullscreen" },
  args: { data: capabilitiesRail },
} satisfies Meta<typeof LandingSectionRailBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const React: Story = {};
export const SSRStatic: Story = { decorators: [withIslands], parameters: { ssr: "static" } };
export const SSRInteractive: Story = { decorators: [withIslands], parameters: { ssr: "interactive" } };
