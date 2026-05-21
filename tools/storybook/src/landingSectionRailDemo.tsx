import {
  LandingSectionRail,
  LandingSectionRailCardFrame,
  LandingSectionRailStyles,
  type LandingSectionRailRenderState,
} from "front-core";
import ceoImage from "../../../../../images/ceo.png";
import cnc1Image from "../../../../../images/cnc1.png";
import cnc2Image from "../../../../../images/cnc2.png";

export type CapabilityItem = {
  bullets: string[];
  copy: string;
  id: string;
  title: string;
};

export type MachineItem = {
  availability: string;
  bullets: string[];
  id: string;
  image: string;
  meta: string;
  status: "busy" | "free";
  title: string;
};

export type TeamItem = {
  bullets: string[];
  id: string;
  image?: string;
  quote: string;
  role: string;
  title: string;
};

export const capabilities: CapabilityItem[] = [
  {
    id: "milling",
    title: "Milling",
    copy: "3- and 4-axis machining for steel, aluminum, brass, and plastics. One-off parts, small batches, and medium runs.",
    bullets: [
      "Best for plates, housings, fixtures",
      "Up to 1200×600×500",
      "Route check today",
    ],
  },
  {
    id: "turning",
    title: "Turning",
    copy: "Bar and chuck work. Multi-axis parts with milled contour in one setup.",
    bullets: [
      "Round parts and threaded shafts",
      "Bar up to 65 mm",
      "Turning + milling in one setup",
    ],
  },
  {
    id: "five-axis",
    title: "5-axis machining",
    copy: "Impellers, blades, complex housings. Precise bases and smooth surfaces.",
    bullets: [
      "Complex geometry in one setup",
      "Fewer refixtures, better bases",
      "3 available 5-axis cells",
    ],
  },
  {
    id: "edm",
    title: "EDM cutting",
    copy: "Wire and sinker EDM for hardened steels and carbide tooling.",
    bullets: [
      "Hardened steel and carbide",
      "Sharp internal corners",
      "Wire + sinker EDM",
    ],
  },
  {
    id: "laser",
    title: "Laser · welding · bending",
    copy: "Sheet cutting, TIG/MIG welding, assemblies, and formed brackets.",
    bullets: [
      "Sheet metal assemblies",
      "Cut, bend, weld in one route",
      "Fast prototype batches",
    ],
  },
];

export const machines: MachineItem[] = [
  {
    id: "dmu-50",
    availability: "in work · next slot tomorrow",
    bullets: ["5-axis cell", "500×450×400 travel", "14k rpm spindle"],
    image: cnc1Image,
    title: "DMG MORI DMU 50",
    meta: "5-axis · 2021 · complex housings",
    status: "busy",
  },
  {
    id: "nlx-2500",
    availability: "busy · free after 21:00",
    bullets: ["Turning-mill", "Y-axis operations", "Good for shafts and flanges"],
    image: cnc2Image,
    title: "DMG MORI NLX 2500",
    meta: "turning-mill · 2022 · Y-axis",
    status: "busy",
  },
  {
    id: "vf-2ss",
    availability: "busy · free after 15:20",
    bullets: ["Fast 3-axis milling", "762×406 work area", "Good for plates"],
    image: cnc1Image,
    title: "HAAS VF-2SS",
    meta: "3-axis · 2019 · 762×406",
    status: "busy",
  },
  {
    id: "vmx42",
    availability: "free · can start today",
    bullets: ["Open slot today", "1067×610 travel", "Aluminum and plastics"],
    image: cnc2Image,
    title: "Hurco VMX42",
    meta: "3-axis · 2020 · 1067×610",
    status: "free",
  },
  {
    id: "c42",
    availability: "free · precision cell",
    bullets: ["5-axis precision", "Ø 800 table", "QC route available"],
    image: cnc1Image,
    title: "Hermle C42 U",
    meta: "5-axis · 2020 · Ø 800 table",
    status: "free",
  },
];

export const team: TeamItem[] = [
  {
    id: "morozov",
    image: ceoImage,
    role: "chief technologist",
    title: "Sergey Morozov",
    quote: "If a part cannot be made the first time, the route was chosen incorrectly. We fix that before launch.",
    bullets: [
      "Owns route planning",
      "22 years in CNC",
      "Checks risky orders before launch",
    ],
  },
  {
    id: "kochin",
    role: "CNC operator",
    title: "Pavel Kochin",
    quote: "The machine is only fast when preparation is precise.",
    bullets: [
      "5-axis setup",
      "Day shift",
      "Good at tight fixtures",
    ],
  },
  {
    id: "ivanova",
    role: "quality engineer",
    title: "Anna Ivanova",
    quote: "Measurement is part of production, not a final ceremony.",
    bullets: [
      "Measurement reports",
      "CMM control",
      "Customer-ready inspection packs",
    ],
  },
];

function CapabilityCard({ active, expanded, item }: LandingSectionRailRenderState<CapabilityItem>) {
  return (
    <LandingSectionRailCardFrame active={active} className="rail-demo-card rail-demo-capability" data-tone={active && !expanded ? "dark" : "light"}>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
      <ul className="rail-demo-facts">
        {item.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </LandingSectionRailCardFrame>
  );
}

function MachineCard({ active, item }: LandingSectionRailRenderState<MachineItem>) {
  return (
    <LandingSectionRailCardFrame active={active} className="rail-demo-card rail-demo-machine">
      <div className="rail-demo-machine-photo" data-active={active ? "true" : "false"}>
        <img src={item.image} alt="" aria-hidden="true" />
      </div>
      <h3>{item.title}</h3>
      <p>{item.meta}</p>
      <ul className="rail-demo-facts">
        {item.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className="rail-demo-status" data-status={item.status}>
        {item.availability}
      </div>
    </LandingSectionRailCardFrame>
  );
}

function TeamCard({ active, item }: LandingSectionRailRenderState<TeamItem>) {
  const initials = item.title
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <LandingSectionRailCardFrame active={active} className="rail-demo-card rail-demo-team">
      <div className="rail-demo-portrait">
        {item.image ? <img src={item.image} alt="" aria-hidden="true" /> : <span>{initials}</span>}
      </div>
      <div className="rail-demo-team-header">
        <h3>{item.title}</h3>
        <p>{item.role}</p>
      </div>
      <p className="rail-demo-quote">“{item.quote}”</p>
      <ul className="rail-demo-facts">
        {item.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </LandingSectionRailCardFrame>
  );
}

export function CapabilitiesRail() {
  return (
    <LandingSectionRail
      className="rail-demo-capabilities-rail"
      expandable
      items={capabilities}
      meta={<><strong>5</strong> directions · <strong>47</strong> machines · since 2010</>}
      railLabel="Shop capabilities"
      renderItem={(state) => <CapabilityCard {...state} />}
      title="Shop capabilities"
      variant="default"
    />
  );
}

export function MachinesRail() {
  return (
    <LandingSectionRail
      className="rail-demo-machines-rail"
      expandable
      initialActiveId="dmu-50"
      items={machines}
      meta={<><strong>14</strong> in work now · 12 shown</>}
      railLabel="Machines in shop"
      renderItem={(state) => <MachineCard {...state} />}
      title="Machines in shop"
      variant="immersive"
    />
  );
}

export function TeamRail() {
  return (
    <LandingSectionRail
      className="rail-demo-team-rail"
      expandable
      items={team}
      meta={<>technologists · operators · QC</>}
      railLabel="Shop team"
      renderItem={(state) => <TeamCard {...state} />}
      title="Shop team"
      variant="default"
    />
  );
}

export function LandingSectionRailDemoStyles() {
  return (
    <>
      <LandingSectionRailStyles />
      <style>{railDemoCss}</style>
    </>
  );
}

const railDemoCss = `
/* The page background and the rail's own colors are derived from the
   --ui-* theme tokens so the same components flip in light/dark mode. */
.rail-demo-page {
  min-height: 100vh;
  background: var(--ui-background);
  color: var(--ui-foreground);
  --topbar-page: var(--ui-background);
  --topbar-surface: var(--ui-card);
  --topbar-ink: var(--ui-foreground);
  --topbar-muted: var(--ui-muted-foreground);
  --topbar-border: var(--ui-border);
  --topbar-login: var(--ui-foreground);
}

.rail-demo-page .landing-section-rail {
  --landing-rail-card-width: 280px;
  --landing-rail-card-active-width: min(560px, calc(100vw - 42px));
  --landing-rail-card-height: 500px;
  padding: 78px max(18px, calc((100vw - 1500px) / 2 + 18px)) 58px;
}

.rail-demo-page .landing-section-rail[data-variant="immersive"] {
  --landing-rail-card-width: 320px;
  --landing-rail-card-active-width: min(660px, calc(100vw - 42px));
  --landing-rail-card-height: 594px;
}

.rail-demo-page .rail-demo-team-rail {
  --landing-rail-card-height: 540px;
}

.rail-demo-page .landing-section-rail + .landing-section-rail {
  padding-top: 92px;
}

.rail-demo-page .landing-section-rail__header {
  margin-bottom: 46px;
}

.rail-demo-page .landing-section-rail__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  margin-top: 30px;
}

.rail-demo-page .landing-section-rail__viewport {
  gap: 20px;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.rail-demo-page .landing-section-rail__viewport::-webkit-scrollbar {
  display: none;
}

.rail-demo-page .landing-section-rail__viewport[data-expanded="true"] {
  gap: 22px;
}

.rail-demo-page .landing-section-rail__viewport[data-expanded="true"] .landing-section-rail__card {
  min-height: 430px;
}

.rail-demo-page .landing-section-rail-card-frame {
  padding: 30px;
}

.rail-demo-page .landing-section-rail__mobile-nav {
  display: grid;
  grid-template-columns: 54px minmax(0, 180px) 54px;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: min(460px, 100%);
  margin: 0;
}

.rail-demo-page .landing-section-rail__mobile-nav[data-expanded="true"] {
  display: none;
}

.rail-demo-page .landing-section-rail__mobile-nav button {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid color-mix(in oklch, var(--landing-rail-ink) 14%, transparent);
  border-radius: 50%;
  background: color-mix(in oklch, var(--landing-rail-ink) 5%, transparent);
  color: var(--landing-rail-ink);
  cursor: pointer;
  font: inherit;
  padding: 0;
  transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
}

.rail-demo-page .landing-section-rail__mobile-nav button span {
  display: block;
  color: currentColor;
  font-size: 30px;
  font-weight: 750;
  line-height: 1;
  transform: translateY(-2px);
}

.rail-demo-page .landing-section-rail__mobile-nav button:not(:disabled):hover {
  background: color-mix(in oklch, var(--landing-rail-ink) 9%, transparent);
  border-color: color-mix(in oklch, var(--landing-rail-ink) 24%, transparent);
  transform: translateY(-1px);
}

.rail-demo-page .landing-section-rail__mobile-nav button:disabled {
  cursor: default;
  opacity: 0.3;
}

.rail-demo-page .landing-section-rail__side {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rail-demo-page .landing-section-rail__meta {
  padding: 0;
  color: color-mix(in oklch, var(--landing-rail-ink) 62%, transparent);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  text-align: left;
}

.rail-demo-page .landing-section-rail__expand {
  height: 54px;
  min-width: 116px;
  border-color: color-mix(in oklch, var(--landing-rail-ink) 14%, transparent);
  background: color-mix(in oklch, var(--landing-rail-ink) 5%, transparent);
  font-size: 15px;
  font-weight: 750;
  padding: 0 22px;
}

.rail-demo-page .landing-section-rail__expand:hover {
  background: color-mix(in oklch, var(--landing-rail-ink) 9%, transparent);
  border-color: color-mix(in oklch, var(--landing-rail-ink) 24%, transparent);
}

.rail-demo-page .landing-section-rail__mobile-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.rail-demo-page .landing-section-rail__mobile-progress i {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--landing-rail-ink) 22%, transparent);
  transition: background 160ms ease, width 160ms ease;
}

.rail-demo-page .landing-section-rail__mobile-progress i[data-active="true"] {
  width: 34px;
  background: var(--landing-rail-ink);
}

.rail-demo-card h3 {
  margin: 24px 0 18px;
  color: currentColor;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.12;
}

.landing-section-rail__card[data-active="true"] .rail-demo-card h3 {
  font-size: 40px;
  line-height: 1.06;
}

.rail-demo-page .rail-demo-team[data-active="true"] {
  border-color: color-mix(in oklch, var(--ui-border) 72%, var(--landing-rail-ink));
}

.rail-demo-team .rail-demo-team-header {
  display: grid;
  gap: 7px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 78%, transparent);
}

.rail-demo-team h3,
.landing-section-rail__card[data-active="true"] .rail-demo-team h3 {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.rail-demo-team .rail-demo-team-header p {
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 14px;
  line-height: 1.35;
}

.rail-demo-card p {
  margin: 0;
  color: color-mix(in oklch, currentColor 64%, transparent);
  font-size: 16px;
  line-height: 1.62;
}

/* Inverted-contrast card for the active capability — bg/text flip with the
   theme so the highlight stays readable in both light and dark mode. */
.rail-demo-card[data-tone="dark"] {
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.rail-demo-facts {
  display: grid;
  gap: 13px;
  margin: auto 0 0;
  padding: 28px 0 0;
  list-style: none;
}

.rail-demo-facts li {
  color: color-mix(in oklch, currentColor 78%, transparent);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.45;
}

.rail-demo-facts li::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 9px 2px 0;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.45;
}

.rail-demo-machine-photo {
  position: relative;
  display: grid;
  place-items: start;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.rail-demo-portrait {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background:
    repeating-linear-gradient(-45deg,
      color-mix(in oklch, var(--ui-muted) 92%, transparent) 0 5px,
      color-mix(in oklch, var(--ui-muted) 78%, transparent) 5px 9px),
    var(--ui-muted);
}

.rail-demo-portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 34%;
}

.rail-demo-machine-photo {
  height: 150px;
}

.rail-demo-machine-photo[data-active="true"] {
  height: 250px;
}

.rail-demo-machine-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  filter: saturate(0.9) contrast(1.03);
  transition: transform 220ms ease;
}

.landing-section-rail__card[data-active="true"] .rail-demo-machine-photo img {
  transform: scale(1.03);
}

.rail-demo-machine-photo::after {
  content: "";
  position: absolute;
  inset: 0;
  display: none;
  pointer-events: none;
}

.rail-demo-status {
  margin-top: 28px;
  color: var(--ui-muted-foreground);
  font-size: 15px;
  font-weight: 650;
}

.rail-demo-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 999px;
  background: #22c55e;
}

.rail-demo-status[data-status="busy"]::before {
  background: color-mix(in oklch, var(--ui-muted-foreground) 60%, transparent);
}

.rail-demo-portrait {
  height: 220px;
  margin-bottom: 24px;
}

.landing-section-rail__card[data-active="true"] .rail-demo-portrait {
  height: 280px;
}

.rail-demo-team .rail-demo-portrait,
.landing-section-rail__card[data-active="true"] .rail-demo-team .rail-demo-portrait {
  height: 196px;
  margin-bottom: 22px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--ui-muted) 72%, var(--ui-card));
}

.rail-demo-team .rail-demo-portrait span {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 86%, transparent);
  border-radius: 999px;
  background: color-mix(in oklch, var(--ui-card) 88%, transparent);
  color: var(--ui-muted-foreground);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.rail-demo-quote {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--ui-border);
  font-style: italic;
}

.rail-demo-team .rail-demo-quote {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--ui-muted-foreground);
  font-size: 14px;
  line-height: 1.58;
}

.rail-demo-team .rail-demo-facts {
  gap: 9px;
  padding-top: 22px;
}

.rail-demo-team .rail-demo-facts li {
  color: color-mix(in oklch, var(--landing-rail-ink) 72%, transparent);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.35;
}

@media (max-width: 760px) {
  .rail-demo-page .landing-section-rail {
    padding: 54px 14px 44px;
  }

  .rail-demo-page .landing-section-rail + .landing-section-rail {
    padding-top: 64px;
  }

  .rail-demo-page .landing-section-rail__header {
    margin-bottom: 30px;
  }

  .rail-demo-page .landing-section-rail__controls {
    display: grid;
    gap: 16px;
    justify-content: stretch;
    margin-top: 18px;
  }

  .rail-demo-page .landing-section-rail__viewport {
    gap: 14px;
  }

  .rail-demo-page .landing-section-rail__mobile-nav {
    width: 100%;
    grid-template-columns: 54px minmax(0, 1fr) 54px;
  }

  .rail-demo-page .landing-section-rail__side {
    justify-content: space-between;
  }

  .rail-demo-page .landing-section-rail__card,
  .rail-demo-page .landing-section-rail__viewport[data-expanded="true"] .landing-section-rail__card {
    --landing-rail-card-height: 460px;
  }

  .rail-demo-page .landing-section-rail-card-frame {
    padding: 24px;
  }

  .landing-section-rail__card[data-active="true"] .rail-demo-card h3 {
    font-size: 32px;
  }

  .rail-demo-machine-photo,
  .rail-demo-machine-photo[data-active="true"] {
    height: 170px;
  }

  .rail-demo-portrait,
  .landing-section-rail__card[data-active="true"] .rail-demo-portrait {
    height: 230px;
  }

  .rail-demo-team .rail-demo-portrait,
  .landing-section-rail__card[data-active="true"] .rail-demo-team .rail-demo-portrait {
    height: 180px;
  }
}
`;
