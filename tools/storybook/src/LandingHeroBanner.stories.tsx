import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { HeroBanner, type HeroBannerProps, type HeroBannerTheme } from "front-core";

const workshopImage = "/services/galery/static/workshop.png";

function HeroBannerFrame({
  children,
  theme = "dark",
}: {
  children: ReactNode;
  theme?: HeroBannerTheme;
}) {
  return (
    <div className="landing-hero-story" data-theme={theme}>
      <style>{storyFrameCss}</style>
      {children}
    </div>
  );
}

const storyFrameCss = `
.landing-hero-story {
  min-height: 100vh;
  background: var(--hero-page);
  color: var(--hero-ink);
  padding: 0;
}

.landing-hero-story[data-theme="dark"] {
  color-scheme: dark;
  --hero-page: #050506;
  --hero-ink: #f8fafc;
}

.landing-hero-story[data-theme="light"] {
  color-scheme: light;
  --hero-page: #f7f7f6;
  --hero-ink: #ffffff;
}
`;

const meta = {
  title: "Landing/HeroBanner",
  component: HeroBanner,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    backgroundImage: workshopImage,
    headline: "ask anything.",
    highlight: "attach everything.",
    description:
      "One chat surface, every model, your files in context. Drop a PDF, paste a screenshot, or just start typing.",
  },
} satisfies Meta<typeof HeroBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
  render: (args: HeroBannerProps) => (
    <HeroBannerFrame theme={args.theme}>
      <HeroBanner {...args} />
    </HeroBannerFrame>
  ),
};

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
  render: (args: HeroBannerProps) => (
    <HeroBannerFrame theme={args.theme}>
      <HeroBanner {...args} />
    </HeroBannerFrame>
  ),
};
