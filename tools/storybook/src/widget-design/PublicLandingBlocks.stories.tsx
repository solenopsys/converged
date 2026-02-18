import type { Meta, StoryObj } from "@storybook/react";
import { HeroMain } from "front-landings/sections/hero-main";
import { VideoBlock } from "front-landings/sections/video-block";
import { Logos8 } from "front-landings/sections/logos8";
import { Hero } from "front-landings/sections/hero";
import { Pricing2 } from "front-landings/sections/pricing";
import { Stats } from "front-landings/sections/stats";
import { Faq } from "front-landings/sections/faq";
import { MagicCTA } from "front-landings/sections/cta-section";
import { Feature } from "front-landings/sections/feature";

import heroMainData from "../../../../../../static-data/content/ru/meta/hero-main.json";
import videoData from "../../../../../../static-data/content/ru/meta/video.json";
import logosData from "../../../../../../static-data/content/ru/meta/logos.json";
import heroData from "../../../../../../static-data/content/ru/meta/hero-platform.json";
import pricingData from "../../../../../../static-data/content/ru/meta/pricing.json";
import statsData from "../../../../../../static-data/content/ru/meta/stats.json";
import faqData from "../../../../../../static-data/content/ru/meta/faq.json";
import featureData from "../../../../../../static-data/content/ru/meta/feture.json";
import dialogJoinData from "../../../../../../static-data/content/ru/meta/dialog-join.json";
import uiData from "../../../../../../static-data/content/ru/meta/ui.json";

const meta: Meta = {
  title: "Public/LandingBlocks",
  tags: ["public"],
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#02040f" }],
    },
  },
};

export default meta;
type Story = StoryObj;

const pageWrap = {
  margin: "0 auto",
  maxWidth: "1200px",
  padding: "24px 16px 64px",
} as const;

export const HeroMainBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <HeroMain
        {...(heroMainData as any)}
        texts={dialogJoinData as any}
        lang="ru"
      />
    </div>
  ),
};

export const ClubBenefitsVideoBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <VideoBlock
        title={(videoData as any).title}
        blocks={(videoData as any).blocks}
        texts={dialogJoinData as any}
        buttonText={(heroMainData as any).buttonText}
        lang="ru"
        video_src={(videoData as any).video_src}
        isShorts={true}
      />
    </div>
  ),
};

export const AiLogosBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Logos8 {...(logosData as any)} />
    </div>
  ),
};

export const ConvergedHeroBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Hero data={heroData as any} />
    </div>
  ),
};

export const ProductFeaturesBentoBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Feature
        title={(featureData as any).title}
        feature={(featureData as any).items}
      />
    </div>
  ),
};

export const PricingBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Pricing2
        plans={(pricingData as any).plans}
        heading={(pricingData as any).heading}
        description={(pricingData as any).description}
      />
    </div>
  ),
};

export const StatsBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Stats content={statsData as any} />
    </div>
  ),
};

export const MagicCtaBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <MagicCTA
        title={(heroMainData as any).heading}
        description={(heroMainData as any).description}
        stats={(statsData as any).stats ?? []}
        primaryText={(uiData as any).nav.solutions}
        primaryHref="/ru/solutions/"
        secondaryText={(uiData as any).nav.product}
        secondaryHref="/ru/product/"
      />
    </div>
  ),
};

export const FaqBlock: Story = {
  render: () => (
    <div style={pageWrap as any}>
      <Faq
        faqs={(faqData as any).faqs}
        title={(faqData as any).title}
      />
    </div>
  ),
};
