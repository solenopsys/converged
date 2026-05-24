import {
  LandingSectionRailBlock,
  type LandingSectionRailBlockData,
} from "front-core";

const ceoImage = "/landing/cnc/ceo.png";
const cnc1Image = "/landing/cnc/cnc1.png";
const cnc2Image = "/landing/cnc/cnc2.png";

export const capabilitiesRail: LandingSectionRailBlockData = {
  kind: "capabilities",
  title: "Shop capabilities",
  railLabel: "Shop capabilities",
  variant: "default",
  expandable: true,
  meta: [
    { text: "5", strong: true },
    { text: " directions · " },
    { text: "47", strong: true },
    { text: " machines · since 2010" },
  ],
  items: [
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
  ],
};

export const machinesRail: LandingSectionRailBlockData = {
  kind: "machines",
  title: "Machines in shop",
  railLabel: "Machines in shop",
  variant: "immersive",
  expandable: true,
  initialActiveId: "dmu-50",
  meta: [
    { text: "14", strong: true },
    { text: " in work now · 12 shown" },
  ],
  items: [
    {
      id: "dmu-50",
      availability: "in work · next slot tomorrow",
      bullets: ["5-axis cell", "500×450×400 travel", "14k rpm spindle"],
      image: cnc1Image,
      imageAlt: "DMG MORI DMU 50 machining center",
      title: "DMG MORI DMU 50",
      meta: "5-axis · 2021 · complex housings",
      status: "busy",
    },
    {
      id: "nlx-2500",
      availability: "busy · free after 21:00",
      bullets: ["Turning-mill", "Y-axis operations", "Good for shafts and flanges"],
      image: cnc2Image,
      imageAlt: "DMG MORI NLX 2500 turning-mill cell",
      title: "DMG MORI NLX 2500",
      meta: "turning-mill · 2022 · Y-axis",
      status: "busy",
    },
    {
      id: "vf-2ss",
      availability: "busy · free after 15:20",
      bullets: ["Fast 3-axis milling", "762×406 work area", "Good for plates"],
      image: cnc1Image,
      imageAlt: "HAAS VF-2SS mill",
      title: "HAAS VF-2SS",
      meta: "3-axis · 2019 · 762×406",
      status: "busy",
    },
    {
      id: "vmx42",
      availability: "free · can start today",
      bullets: ["Open slot today", "1067×610 travel", "Aluminum and plastics"],
      image: cnc2Image,
      imageAlt: "Hurco VMX42 machining center",
      title: "Hurco VMX42",
      meta: "3-axis · 2020 · 1067×610",
      status: "free",
    },
    {
      id: "c42",
      availability: "free · precision cell",
      bullets: ["5-axis precision", "Ø 800 table", "QC route available"],
      image: cnc1Image,
      imageAlt: "Hermle C42 U precision cell",
      title: "Hermle C42 U",
      meta: "5-axis · 2020 · Ø 800 table",
      status: "free",
    },
  ],
};

export const teamRail: LandingSectionRailBlockData = {
  kind: "team",
  title: "Shop team",
  railLabel: "Shop team",
  variant: "default",
  expandable: true,
  meta: "technologists · operators · QC",
  items: [
    {
      id: "morozov",
      image: ceoImage,
      imageAlt: "Sergey Morozov in the CNC shop",
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
      bullets: ["5-axis setup", "Day shift", "Good at tight fixtures"],
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
  ],
};

export function CapabilitiesRail() {
  return <LandingSectionRailBlock data={capabilitiesRail} />;
}

export function MachinesRail() {
  return <LandingSectionRailBlock data={machinesRail} />;
}

export function TeamRail() {
  return <LandingSectionRailBlock data={teamRail} />;
}

export function LandingSectionRailDemoStyles() {
  return (
    <style>{`
.rail-demo-page {
  min-height: 100vh;
  background: var(--ui-background);
  color: var(--ui-foreground);
}
`}</style>
  );
}
