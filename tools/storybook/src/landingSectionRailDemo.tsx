import {
  LandingSectionRail,
  LandingSectionRailCardFrame,
  LandingSectionRailStyles,
  type LandingSectionRailRenderState,
} from "front-core";
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
  return (
    <LandingSectionRailCardFrame active={active} className="rail-demo-card rail-demo-team">
      <div className="rail-demo-portrait">
      </div>
      <h3>{item.title}</h3>
      <p>{item.role}</p>
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

.rail-demo-card h3 {
  margin: 18px 0 14px;
  color: currentColor;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 1.04;
}

.landing-section-rail__card[data-active="true"] .rail-demo-card h3 {
  font-size: clamp(31px, 3vw, 46px);
}

.rail-demo-card p {
  margin: 0;
  color: color-mix(in oklch, currentColor 64%, transparent);
  font-size: 15px;
  line-height: 1.45;
}

/* Inverted-contrast card for the active capability — bg/text flip with the
   theme so the highlight stays readable in both light and dark mode. */
.rail-demo-card[data-tone="dark"] {
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.rail-demo-facts {
  display: grid;
  gap: 10px;
  margin: auto 0 0;
  padding: 0;
  list-style: none;
}

.rail-demo-facts li {
  color: color-mix(in oklch, currentColor 78%, transparent);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.28;
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
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background: var(--ui-muted);
}

.rail-demo-portrait {
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

.rail-demo-machine-photo {
  height: 120px;
}

.rail-demo-machine-photo[data-active="true"] {
  height: 210px;
}

.rail-demo-machine-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 42%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.18), transparent 48%);
  pointer-events: none;
}

.rail-demo-status {
  margin-top: auto;
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
  margin-bottom: 18px;
}

.landing-section-rail__card[data-active="true"] .rail-demo-portrait {
  height: 300px;
}

.rail-demo-quote {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--ui-border);
  font-style: italic;
}
`;
