import type { ReactNode } from "react";
import type { SalesIslandData } from "front-core";

/**
 * Demo data + stage chrome for the Sales Island stories.
 *
 * Mirrors `struct/data/en/product/landing/sales-island.json` so Storybook shows
 * exactly what the landing config renders. The data is intentionally NOT
 * hardcoded into the component — this is the localized JSON shape.
 */

export const salesIslandData: SalesIslandData = {
  enabled: true,
  placement: "stage",
  defaultExpanded: false,
  mark: "robot",
  brand: "4ir.club · demo",
  eyebrow: "replace your website",
  eyebrowIcon: "spark",
  title: "AI sales tool for your CNC shop",
  lead: "An AI-powered tool that captures RFQ requests, accepts drawings, answers customer questions, and handles after-hours calls — instead of a static brochure site.",
  barCopy: [
    { text: "Replace your old CNC shop website with an " },
    { text: "AI-powered quote intake tool", strong: true },
    { text: " — RFQ, drawings, after-hours calls." },
  ],
  mobileCopy: [
    { text: "$288/year", strong: true },
    { text: " · 14-day refund" },
  ],
  price: { amount: "$288", period: "/year", note: "14-day money-back guarantee" },
  primaryCta: { label: "Pay $288 & start setup", icon: "arrow", href: "https://4ir.lemonsqueezy.com/checkout/buy/0499ee6c-a59d-4f7b-86b5-59e42666c7b6" },
  toggle: { expand: "See how it works", collapse: "Collapse" },
  included: {
    title: "What's included",
    items: [
      { id: "ai-chat", label: "AI chat", icon: "chat" },
      { id: "rfq", label: "RFQ intake", icon: "rfq" },
      { id: "upload", label: "File upload", icon: "upload" },
      { id: "leads", label: "Lead cards", icon: "leads" },
      { id: "hosting", label: "Hosting", icon: "hosting" },
      { id: "setup", label: "Setup", icon: "setup" },
      { id: "updates", label: "Updates", icon: "updates" },
      { id: "after-hours", label: "After-hours calls", icon: "phone" },
    ],
  },
  steps: {
    title: "How it works",
    items: [
      {
        id: "capture",
        body: [
          { text: "Customer lands on your tool, drops a drawing or asks a question — " },
          { text: "AI answers and captures the RFQ", strong: true },
          { text: "." },
        ],
      },
      {
        id: "after-hours",
        body: [
          { text: "After hours, the AI " },
          { text: "takes the call", strong: true },
          { text: " and logs the request as a lead card." },
        ],
      },
      {
        id: "quote",
        body: [
          { text: "You open the admin and see " },
          { text: "structured leads", strong: true },
          { text: " — files, specs, contact, ready to quote." },
        ],
      },
    ],
  },
  maker: { title: "Who built it", badge: "4", name: "4ir.club", by: "by Converged AI" },
  guarantee: {
    icon: "shield",
    text: [
      { text: "14-day money-back guarantee.", strong: true },
      { text: " Not a fit? Full refund, no questions." },
    ],
  },
  adminLink: { label: "Already a customer? Admin login →", href: "/console", icon: "key" },
};

/**
 * Faux landing behind the island so the dock reads as an overlay, mirroring the
 * original design sketch. The island uses `placement: "stage"` to pin itself to
 * this relative container instead of the viewport.
 */
export function SalesIslandStage({ children }: { children: ReactNode }) {
  return (
    <div className="sales-stage">
      <SalesIslandStageStyles />
      <span className="sales-stage__tag">demo site · sales island pinned to the bottom</span>
      <div className="sales-stage__backdrop" aria-hidden="true">
        <div className="sales-stage__topbar">
          <div className="sales-stage__logo">⬛ ЦЕХ·47</div>
          <div className="sales-stage__nav">
            <span>Capabilities</span>
            <span>Machines</span>
            <span>Team</span>
            <span>Docs</span>
          </div>
        </div>
        <div className="sales-stage__grid">
          <div className="sales-stage__box sales-stage__box--big">
            <i className="sales-stage__line sales-stage__line--dk sales-stage__line--w40" />
            <i className="sales-stage__line sales-stage__line--dk" />
            <i className="sales-stage__line sales-stage__line--dk sales-stage__line--w60" />
          </div>
          <div className="sales-stage__box">
            <i className="sales-stage__line sales-stage__line--w60" />
            <i className="sales-stage__line" />
          </div>
          <div className="sales-stage__box sales-stage__box--dk">
            <i className="sales-stage__line sales-stage__line--dk sales-stage__line--w60" />
            <i className="sales-stage__line sales-stage__line--dk" />
          </div>
          <div className="sales-stage__box">
            <i className="sales-stage__line sales-stage__line--w40" />
            <i className="sales-stage__line" />
          </div>
          <div className="sales-stage__box">
            <i className="sales-stage__line sales-stage__line--w60" />
            <i className="sales-stage__line" />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function SalesIslandStageStyles() {
  return (
    <style>{`
.sales-stage {
  position: relative;
  height: 100vh;
  min-height: 760px;
  overflow: hidden;
  background: linear-gradient(180deg, oklch(0.97 0.004 80), oklch(0.93 0.005 80));
}
.sales-stage__tag {
  position: absolute; top: 24px; right: 32px; z-index: 30;
  font-family: ui-monospace, monospace; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.14em;
  color: oklch(0.62 0.005 80);
  background: oklch(1 0 0 / 0.7); border: 1px solid oklch(0.84 0.005 80);
  padding: 6px 12px; border-radius: 999px; backdrop-filter: blur(6px);
}
.sales-stage__backdrop { position: absolute; inset: 0; padding: 28px 48px; opacity: 0.85; pointer-events: none; }
.sales-stage__topbar { display: flex; align-items: center; gap: 22px; height: 34px; margin-bottom: 28px; }
.sales-stage__logo { font-family: ui-monospace, monospace; font-weight: 600; font-size: 15px; }
.sales-stage__nav { display: flex; gap: 18px; font-size: 12px; color: oklch(0.62 0.005 80); }
.sales-stage__grid { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-auto-rows: 150px; gap: 12px; max-width: 1180px; margin: 0 auto; }
.sales-stage__box { background: #fff; border: 1px solid oklch(0.84 0.005 80); border-radius: 14px; }
.sales-stage__box--big { grid-row: span 2; background: oklch(0.15 0.008 80); }
.sales-stage__box--dk { background: oklch(0.15 0.008 80); }
.sales-stage__line { display: block; height: 10px; background: oklch(0.9 0.005 80); border-radius: 4px; margin: 16px; }
.sales-stage__line--w60 { width: 60%; }
.sales-stage__line--w40 { width: 40%; }
.sales-stage__line--dk { background: oklch(0.26 0.008 80); }
`}</style>
  );
}
