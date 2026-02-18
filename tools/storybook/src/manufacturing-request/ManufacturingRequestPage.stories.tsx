import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ManufacturingRequestPage,
  type ManufacturingRequest,
  type PartAnalysis,
} from "./ManufacturingRequestPage";

const makePreview = (title: string, hue: number) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='960' height='600' viewBox='0 0 960 600'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},90%,95%)'/>
      <stop offset='100%' stop-color='hsl(${(hue + 35) % 360},70%,82%)'/>
    </linearGradient>
    <linearGradient id='shape' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},78%,45%)'/>
      <stop offset='100%' stop-color='hsl(${(hue + 45) % 360},80%,34%)'/>
    </linearGradient>
  </defs>
  <rect width='960' height='600' fill='url(#bg)'/>
  <g transform='translate(480,290)'>
    <polygon points='0,-160 200,-50 0,60 -200,-50' fill='url(#shape)' opacity='0.95'/>
    <polygon points='-200,-50 0,60 0,240 -200,130' fill='hsl(${(hue + 15) % 360},70%,28%)' opacity='0.86'/>
    <polygon points='200,-50 0,60 0,240 200,130' fill='hsl(${(hue + 55) % 360},75%,24%)' opacity='0.82'/>
    <ellipse cx='0' cy='252' rx='220' ry='36' fill='rgba(0,0,0,0.22)'/>
  </g>
  <text x='60' y='84' font-family='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace' font-size='36' fill='rgba(15,23,42,0.75)'>${title}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const request: ManufacturingRequest = {
  id: "9e4f2db0-2d71-4f35-b9dc-b52c2a2c972f",
  createdAtISO: "2026-02-07T16:05:00.000Z",
  companyName: "NordFab Robotics",
  contactName: "Alex Storm",
  status: "ready",
  deadlineISO: "2026-02-14",
  publicUrl:
    "https://portal.clarity.example/requests/9e4f2db0-2d71-4f35-b9dc-b52c2a2c972f",
  pwaInstallUrl:
    "https://portal.clarity.example/requests/9e4f2db0-2d71-4f35-b9dc-b52c2a2c972f?install=1",
  notes:
    "Заявка сформирована после диалога с LLM: материалы подтверждены, допуски и количество зафиксированы.",
};

const parts: PartAnalysis[] = [
  {
    id: "prt-001",
    name: "Housing Top",
    process: "printing",
    quantity: 4,
    thumbnailUrl: makePreview("Housing Top", 205),
    boundingBoxMm: [118, 84, 42],
    volumeMm3: 22450,
    surfaceAreaMm2: 18960,
    massGrams: 27.4,
    files: [
      { name: "housing-top.stl", sizeKb: 812, kind: "stl" },
      { name: "housing-top.glb", sizeKb: 520, kind: "glb" },
    ],
    print: {
      filamentType: "PETG Black",
      layerHeightMm: 0.2,
      infillPercent: 30,
      estimatedTimeMin: 128,
      materialGrams: 31.2,
      supportVolumeMm3: 4600,
    },
  },
  {
    id: "prt-002",
    name: "Air Duct",
    process: "printing",
    quantity: 2,
    thumbnailUrl: makePreview("Air Duct", 162),
    boundingBoxMm: [140, 56, 48],
    volumeMm3: 16420,
    surfaceAreaMm2: 20110,
    massGrams: 18.6,
    files: [
      { name: "air-duct.stl", sizeKb: 674, kind: "stl" },
      { name: "air-duct.glb", sizeKb: 431, kind: "glb" },
    ],
    print: {
      filamentType: "ASA Gray",
      layerHeightMm: 0.16,
      infillPercent: 25,
      estimatedTimeMin: 92,
      materialGrams: 21.9,
      supportVolumeMm3: 2100,
    },
  },
  {
    id: "cnc-001",
    name: "Aluminum Fixture Plate",
    process: "cnc",
    quantity: 3,
    thumbnailUrl: makePreview("Fixture Plate", 24),
    boundingBoxMm: [160, 120, 18],
    volumeMm3: 345600,
    surfaceAreaMm2: 63400,
    massGrams: 912,
    files: [
      { name: "fixture-plate.step", sizeKb: 3520, kind: "step" },
      { name: "fixture-plate.glb", sizeKb: 1480, kind: "glb" },
    ],
    cnc: {
      stockMaterial: "Aluminum 6061",
      stockSizeMm: [170, 130, 20],
      setups: 1,
      toolChanges: 4,
      machiningTimeMin: 58,
      toleranceMm: 0.05,
    },
  },
  {
    id: "cnc-002",
    name: "Steel Bracket",
    process: "cnc",
    quantity: 6,
    thumbnailUrl: makePreview("Steel Bracket", 4),
    boundingBoxMm: [82, 60, 10],
    volumeMm3: 49200,
    surfaceAreaMm2: 11840,
    massGrams: 386,
    files: [
      { name: "steel-bracket.step", sizeKb: 2140, kind: "step" },
      { name: "steel-bracket.glb", sizeKb: 930, kind: "glb" },
    ],
    cnc: {
      stockMaterial: "Steel S355",
      stockSizeMm: [90, 70, 12],
      setups: 2,
      toolChanges: 6,
      machiningTimeMin: 41,
      toleranceMm: 0.03,
    },
  },
];

const meta = {
  title: "Prototypes/ManufacturingRequestPage",
  component: ManufacturingRequestPage,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="manufacturing-request-story-scroll" style={{ height: "100vh", overflowY: "auto", overflowX: "hidden" }}>
        <style>{`
          @media print {
            html, body {
              height: auto !important;
              overflow: visible !important;
            }
            .manufacturing-request-story-scroll {
              height: auto !important;
              overflow: visible !important;
            }
          }
        `}</style>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof ManufacturingRequestPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MixedProcesses: Story = {
  args: {
    request,
    parts,
  },
};

export const CncOnly: Story = {
  args: {
    request: {
      ...request,
      id: "c8f9f348-c0d8-43e9-a0f3-1d2ab7f83a81",
      publicUrl: "https://portal.clarity.example/requests/c8f9f348-c0d8-43e9-a0f3-1d2ab7f83a81",
      pwaInstallUrl:
        "https://portal.clarity.example/requests/c8f9f348-c0d8-43e9-a0f3-1d2ab7f83a81?install=1",
      status: "sent",
      notes: "Сценарий для подрядчика ЧПУ: только металлообработка без аддитивных деталей.",
    },
    parts: parts.filter((item) => item.process === "cnc"),
  },
};
