import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CapabilitiesRail,
  LandingSectionRailDemoStyles,
  MachinesRail,
  TeamRail,
} from "./landingSectionRailDemo";
import { withIslands } from "./ssr/withIslands";

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
  title: "Landing/SectionRail/All",
  component: LandingSectionRailShowcase,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LandingSectionRailShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** React — полностью интерактивен через useState/useEffect (как раньше) */
export const React: Story = {};

/** SSR Static — чистый HTML который отдаёт сервер, без каких-либо JS-обработчиков */
export const SSRStatic: Story = {
  decorators: [withIslands],
  parameters: { ssr: "static" },
};

/** SSR Interactive — тот же статический HTML + island-скрипты поверх него */
export const SSRInteractive: Story = {
  decorators: [withIslands],
  parameters: { ssr: "interactive" },
};
