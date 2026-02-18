import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties, ReactNode } from "react";
import { HeroSectionPro } from "front-landings/sections/hero-section-pro";
import { StatsSection } from "front-landings/sections/stats-section";
import { AISection } from "front-landings/sections/ai-section";
import { ServicesSectionPro } from "front-landings/sections/services-section-pro";
import { RequestSection } from "front-landings/sections/request-section";
import { AboutSection } from "front-landings/sections/about-section";
import { TeamSection } from "front-landings/sections/team-section";
import { GallerySection } from "front-landings/sections/gallery-section";
import { ContactSection } from "front-landings/sections/contact-section";
import { LocationMapSection } from "front-landings/sections/location-map-section";
import confData from "../../../../../../static-data/old/site-data/gilbertsmachine/conf.json";
import menuData from "../../../../../../static-data/old/site-data/gilbertsmachine/menu.json";
import servicesData from "../../../../../../static-data/old/site-data/gilbertsmachine/services.json";
import bannersData from "../../../../../../static-data/old/site-data/gilbertsmachine/banners.json";
import contactsData from "../../../../../../static-data/old/site-data/gilbertsmachine/contacts.json";
import requestData from "../../../../../../static-data/old/site-data/gilbertsmachine/request.json";
import contactFormData from "../../../../../../static-data/old/site-data/gilbertsmachine/contact_form.json";
import teamData from "../../../../../../static-data/old/site-data/gilbertsmachine/team.json";
import newsData from "../../../../../../static-data/old/site-data/gilbertsmachine/news.json";
import clientsLogosData from "../../../../../../static-data/old/site-data/gilbertsmachine/clients-logos.json";
import aboutMarkdown from "../../../../../../static-data/old/site-data/gilbertsmachine/about.md?raw";

const meta: Meta = {
  title: "Public/SiteBlocks",
  tags: ["public"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;

const wrapStyle = {
  margin: "0 auto",
  maxWidth: "1280px",
  padding: "24px 16px 64px",
} as const;

const brandStyle = {
  "--ui-accent": "oklch(0.31 0.11 257)",
  "--ui-primary": "oklch(0.31 0.11 257)",
  "--ui-ring": "oklch(0.60 0.20 150)",
} as CSSProperties;

const aboutSummary = aboutMarkdown
  .replace(/^#.+$/gm, "")
  .replace(/\s+/g, " ")
  .trim();

const site = {
  slug: "gilbertsmachine",
  title: confData.title,
  logo: confData.logo?.trim(),
  about: {
    markdown: aboutMarkdown,
    ast: null,
    summary: aboutSummary,
  },
  services: servicesData,
  banners: bannersData,
  gallery: newsData.map((item) => ({ src: item.image, caption: item.title })),
  contacts: contactsData,
  menu: menuData.map((item) => ({ title: item.title, href: item.slug })),
  certs: [],
  clients: clientsLogosData,
  team: teamData,
  requestForm: requestData,
  contactForm: contactFormData,
  news: newsData,
  metrics: {
    stats: [
      { label: "Years in business", value: 1943, prefix: "Since " },
      { label: "Services", value: servicesData.length, suffix: "+" },
      { label: "Team members", value: teamData.length, suffix: "+" },
      { label: "Client logos", value: clientsLogosData.length, suffix: "+" },
    ],
  },
  theme: {
    font: confData.font,
    brandColor: confData.brandColor,
    brandColorAlt: confData.brandColorAlt,
  },
};

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={brandStyle}>
    <div style={wrapStyle as any}>{children}</div>
  </div>
);

export const HeroSectionProBlock: Story = {
  render: () => (
    <div style={brandStyle}>
      <HeroSectionPro site={site as any} />
    </div>
  ),
};

export const StatsSectionBlock: Story = {
  render: () => (
    <Frame>
      <StatsSection metrics={site.metrics as any} />
    </Frame>
  ),
};

export const AISectionBlock: Story = {
  render: () => (
    <Frame>
      <AISection companyName={site.title} />
    </Frame>
  ),
};

export const ServicesSectionProBlock: Story = {
  render: () => (
    <Frame>
      <ServicesSectionPro services={site.services as any} />
    </Frame>
  ),
};

export const RequestSectionBlock: Story = {
  render: () => (
    <Frame>
      <RequestSection
        requestForm={site.requestForm as any}
        contacts={site.contacts as any}
        companyName={site.title}
      />
    </Frame>
  ),
};

export const AboutSectionBlock: Story = {
  render: () => (
    <Frame>
      <AboutSection about={site.about as any} />
    </Frame>
  ),
};

export const TeamSectionBlock: Story = {
  render: () => (
    <Frame>
      <TeamSection team={site.team as any} />
    </Frame>
  ),
};

export const GallerySectionBlock: Story = {
  render: () => (
    <Frame>
      <GallerySection gallery={site.gallery as any} />
    </Frame>
  ),
};

export const ContactSectionBlock: Story = {
  render: () => (
    <Frame>
      <ContactSection
        contacts={site.contacts as any}
        companyName={site.title}
        contactForm={site.contactForm as any}
      />
    </Frame>
  ),
};

export const LocationMapSectionBlock: Story = {
  render: () => (
    <Frame>
      <LocationMapSection
        address={site.contacts.address}
        companyName={site.title}
      />
    </Frame>
  ),
};
