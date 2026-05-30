import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Ruler,
  Upload,
} from "lucide-react";
import {
  HeroScrollLayout,
  type HeroRequestBannerData,
  type LandingTopBarAction,
} from "front-core";
import {
  CapabilitiesRail,
  LandingSectionRailDemoStyles,
  MachinesRail,
  TeamRail,
} from "./landingSectionRailDemo";

const workshopImage = "/services/galery/static/workshop.png";

const actions: LandingTopBarAction[] = [
  { icon: <BadgeCheck size={14} />, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: <Upload size={14} />, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: <CalendarClock size={14} />, label: "Estimate deadline", prompt: "Estimate deadline: " },
  { icon: <ClipboardCheck size={14} />, label: "Request quote", prompt: "Prepare a quote: " },
  { icon: <PackageCheck size={14} />, label: "Choose material", prompt: "Help me choose material: " },
  { icon: <Ruler size={14} />, label: "Check tolerances", prompt: "Check tolerances: " },
];

const heroData: HeroRequestBannerData = {
  headline: "Precision CNC quotes",
  highlight: "from files and specs.",
  description:
    "Upload STEP, STL, DXF or PDF. The assistant extracts material, tolerances, finish and deadline into a review-ready request.",
  backgroundImage: workshopImage,
  request: {
    placeholder: "Example: 25 brackets, STEP, +/-0.05 mm, anodized, Austin by Jun 15.",
    contextName: "request",
  },
};

const languages = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

const menuLinks = [
  { label: "Catalog", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Contacts", href: "#" },
];

function HeroScrollLayoutStory() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <HeroScrollLayout
      topBar={{
        logoLight: "/landing/header-logo-black.svg",
        logoDark: "/landing/header-logo-white.svg",
        actions,
        menuLinks,
        languages,
        currentLanguage: "en",
        isDark,
        onThemeToggle: () => setIsDark((value) => !value),
        onLogin: () => {},
      }}
      hero={{
        ariaLabel: "Hero",
        chips: actions,
        data: heroData,
      }}
    >
      <main className="rail-demo-page">
        <LandingSectionRailDemoStyles />
        <CapabilitiesRail />
        <MachinesRail />
        <TeamRail />
      </main>
    </HeroScrollLayout>
  );
}

const meta = {
  title: "Landing/HeroScrollLayout",
  component: HeroScrollLayout,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HeroScrollLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    hero: { data: heroData },
    topBar: false,
  },
  render: () => <HeroScrollLayoutStory />,
};
