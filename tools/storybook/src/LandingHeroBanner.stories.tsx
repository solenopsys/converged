import type { Meta, StoryObj } from "@storybook/react-vite";
import workshopImage from "../../../../../images/workshop.png";

type ThemeMode = "light" | "dark";

function LandingHeroBannerStory({ theme = "dark" }: { theme?: ThemeMode }) {
  return (
    <div className={theme === "dark" ? "landing-hero-story dark" : "landing-hero-story"} data-theme={theme}>
      <style>{landingHeroCss}</style>
      <section className="landing-hero-banner" aria-label="Landing hero">
        <img className="landing-hero-image" src={workshopImage} alt="" aria-hidden="true" />
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            <span>ask anything.</span>
            <span>attach everything.</span>
          </h1>
          <p className="landing-hero-copy">
            One chat surface, every model, your files in context. Drop a PDF, paste a screenshot, or just start typing.
          </p>
        </div>
      </section>
    </div>
  );
}

const landingHeroCss = `
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
  --hero-muted: rgba(248, 250, 252, 0.76);
  --hero-secondary: rgba(248, 250, 252, 0.64);
  --hero-overlay-top: rgba(2, 6, 12, 0.42);
  --hero-overlay-bottom: rgba(2, 6, 12, 0.74);
  --hero-vignette: rgba(2, 6, 12, 0.72);
}

.landing-hero-story[data-theme="light"] {
  color-scheme: light;
  --hero-page: #f7f7f6;
  --hero-ink: #ffffff;
  --hero-muted: rgba(255, 255, 255, 0.78);
  --hero-secondary: rgba(255, 255, 255, 0.62);
  --hero-overlay-top: rgba(8, 14, 22, 0.34);
  --hero-overlay-bottom: rgba(8, 14, 22, 0.64);
  --hero-vignette: rgba(8, 14, 22, 0.54);
}

.landing-hero-banner {
  position: relative;
  min-height: 560px;
  height: clamp(560px, 72vh, 760px);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #07101a;
}

.landing-hero-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 48%;
  filter: saturate(0.86) contrast(1.04) brightness(0.78);
}

.landing-hero-banner::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 18%, var(--hero-vignette) 100%),
    linear-gradient(180deg, var(--hero-overlay-top), var(--hero-overlay-bottom)),
    linear-gradient(90deg, rgba(2, 6, 12, 0.6), transparent 24%, transparent 76%, rgba(2, 6, 12, 0.6)),
    linear-gradient(180deg, rgba(2, 6, 12, 0.12), rgba(2, 6, 12, 0.34));
  pointer-events: none;
}

.landing-hero-content {
  position: relative;
  z-index: 1;
  width: min(860px, calc(100% - 40px));
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 56px 0 68px;
}

.landing-hero-title {
  margin: 0;
  color: var(--hero-ink);
  font-size: clamp(44px, 7vw, 78px);
  font-weight: 800;
  letter-spacing: -0.065em;
  line-height: 0.98;
}

.landing-hero-title span {
  display: block;
}

.landing-hero-title span + span {
  color: var(--hero-secondary);
}

.landing-hero-copy {
  width: min(620px, 100%);
  margin: 24px 0 0;
  color: var(--hero-muted);
  font-size: clamp(16px, 1.9vw, 21px);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.42;
}

@media (max-width: 720px) {
  .landing-hero-banner {
    min-height: 520px;
    height: 76vh;
  }

  .landing-hero-content {
    width: min(100% - 28px, 540px);
  }
}
`;

const meta = {
  title: "Prototypes/LandingHeroBanner",
  component: LandingHeroBannerStory,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LandingHeroBannerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
};

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
};
