import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { SalesIslandBlock } from "front-core";
import { withIslands } from "../ssr/withIslands";
import { salesIslandData, SalesIslandStage } from "../salesIslandDemo";

const meta = {
  title: "Landing/SalesIsland",
  component: SalesIslandBlock,
  parameters: { layout: "fullscreen" },
  args: { data: salesIslandData },
  render: (args) => (
    <SalesIslandStage>
      <SalesIslandBlock {...args} />
    </SalesIslandStage>
  ),
} satisfies Meta<typeof SalesIslandBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed dock pinned over a faux demo site. Click "See how it works". */
export const Desktop: Story = {};

/** Detail panel revealed on load. */
export const DesktopExpanded: Story = {
  args: { data: { ...salesIslandData, defaultExpanded: true } },
};

/** Phone specimens: collapsed pill → full-screen sheet (forced mobile layout). */
export const Mobile: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="sb-phones">
      <PhoneStyles />
      <Phone label="collapsed — mini pill">
        <SalesIslandBlock data={salesIslandData} />
      </Phone>
      <Phone label="expanded — full screen">
        <SalesIslandBlock data={{ ...salesIslandData, defaultExpanded: true }} />
      </Phone>
    </div>
  ),
};

/** Pure SSR output (static HTML, no interactivity). */
export const SSRStatic: Story = {
  decorators: [withIslands],
  parameters: { ssr: "static" },
};

/** SSR HTML + island hydration — the bar toggles via the vanilla island. */
export const SSRInteractive: Story = {
  decorators: [withIslands],
  parameters: { ssr: "interactive" },
};

function Phone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sb-phone-wrap">
      <span className="sb-phone-label">{label}</span>
      <div className="sb-phone sb-force-mobile">
        <div className="sb-phone-notch" />
        <div className="sb-phone-screen">{children}</div>
      </div>
    </div>
  );
}

function PhoneStyles() {
  return (
    <style>{`
.sb-phones { display: flex; gap: 56px; justify-content: center; align-items: flex-start; padding: 32px; flex-wrap: wrap; }
.sb-phone-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.sb-phone-label { font-family: ui-monospace, monospace; font-size: 11px; color: oklch(0.46 0.005 80); text-transform: uppercase; letter-spacing: 0.1em; }
.sb-phone { width: 340px; height: 720px; background: #000; border-radius: 44px; padding: 11px; box-shadow: 0 24px 60px oklch(0.2 0.01 80 / 0.22); position: relative; }
.sb-phone-screen { width: 100%; height: 100%; border-radius: 34px; overflow: hidden; position: relative; background: linear-gradient(180deg, oklch(0.97 0.004 80), oklch(0.93 0.005 80)); }
.sb-phone-notch { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 112px; height: 26px; background: #000; border-radius: 0 0 16px 16px; z-index: 60; }
/* Force the mobile layout regardless of the Storybook viewport width. The root
   and mobile wrapper stay static so the absolute sheet/scrim resolve against the
   phone screen (.sb-phone-screen) instead of the small bottom-pinned root box. */
.sb-force-mobile [data-island="sales-island"] { position: static; }
.sb-force-mobile .sales-island { position: static; padding: 0; }
.sb-force-mobile .sales-island__dock { display: none; }
.sb-force-mobile .sales-island__mobile { display: block; }
.sb-force-mobile .sales-island__pill { position: absolute; left: 12px; right: 12px; bottom: 14px; width: auto; }
.sb-force-mobile .sales-island__scrim,
.sb-force-mobile .sales-island__sheet { position: absolute; }
`}</style>
  );
}
