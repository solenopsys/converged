import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import type { FileMetadata } from "g-files";
import type { RequestFieldState, RequestModel } from "g-requests";
import { ManufacturingRequestPage } from "../../../../front/microfrontends/business/mf-requests/src/views/RequestDetailView";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        alt?: string;
        "auto-rotate"?: boolean | "";
        "camera-controls"?: boolean | "";
        src?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

const now = "2026-05-26T01:49:00.000Z";

function field(
  key: string,
  label: string,
  value: unknown,
  options: Partial<RequestFieldState> = {},
): RequestFieldState {
  const missing = value === undefined || value === null || value === "";
  return {
    key,
    label,
    type: options.type ?? "text",
    group: options.group ?? "basic",
    required: options.required,
    status: options.status ?? (missing ? "missing" : "filled"),
    unit: options.unit,
    value,
  };
}

const files = {
  "t1_ssict_m.stl": "file-stl-1",
  "locking-nut-1-rv1.glb": "file-glb-1",
  "locking-nut-2-rv1.glb": "file-glb-2",
  "request-notes.pdf": "file-pdf-1",
};

const fileMetadata: Record<string, FileMetadata> = {
  "file-stl-1": {
    id: "file-stl-1",
    name: "t1_ssict_m.stl",
    fileType: "model/stl",
    size: 812000,
    createdAt: now,
    updatedAt: now,
  } as FileMetadata,
  "file-glb-1": {
    id: "file-glb-1",
    name: "locking-nut-1-rv1.glb",
    fileType: "model/gltf-binary",
    size: 520000,
    createdAt: now,
    updatedAt: now,
  } as FileMetadata,
  "file-glb-2": {
    id: "file-glb-2",
    name: "locking-nut-2-rv1.glb",
    fileType: "model/gltf-binary",
    size: 498000,
    createdAt: now,
    updatedAt: now,
  } as FileMetadata,
  "file-pdf-1": {
    id: "file-pdf-1",
    name: "request-notes.pdf",
    fileType: "application/pdf",
    size: 184000,
    createdAt: now,
    updatedAt: now,
  } as FileMetadata,
};

const fields: Record<string, RequestFieldState> = {
  part: field("part", "Модель / назначение", "фигурки покемонов", {
    group: "basic",
    required: true,
  }),
  quantity: field("quantity", "Количество", 10, {
    group: "basic",
    required: true,
    type: "number",
  }),
  material: field("material", "Пластик / материал", "", {
    group: "basic",
    required: true,
    type: "material",
  }),
  printTechnology: field("printTechnology", "Технология печати", "", {
    group: "basic",
    required: true,
  }),
  color: field("color", "Цвет", "", { group: "basic" }),
  dimensions: field("dimensions", "Габариты / размеры", "", {
    group: "geometry",
    required: true,
    type: "dimension",
  }),
  layerHeight: field("layerHeight", "Высота слоя", "", {
    group: "quality",
    type: "number",
    unit: "мм",
  }),
  infill: field("infill", "Заполнение", "", {
    group: "quality",
    type: "number",
    unit: "%",
  }),
  finish: field("finish", "Поверхность / постобработка", "", {
    group: "quality",
  }),
  deadline: field("deadline", "Срок", "", {
    group: "logistics",
    type: "date",
  }),
  city: field("city", "Город доставки", "", {
    group: "logistics",
  }),
  contact: field("contact", "Контакт", "", {
    group: "contact",
    required: true,
  }),
  file_analysis_estimates: field(
    "file_analysis_estimates",
    "Аналитика файлов",
    [
      {
        sourceFileId: "file-stl-1",
        type: "printing",
        data: {
          sourceName: "locking-nut-1-rv1.glb",
          timeSeconds: 372,
          weightGrams: 2.6,
          filamentLengthMeters: 0.87,
          materialVolumeMm3: 2086,
          dimensionsMm: { x: 49.3, y: 45.2, z: 28 },
          estimator: "stl-geometry-rough",
          assumptions: true,
        },
      },
      {
        sourceFileId: "file-glb-2",
        type: "printing",
        data: {
          sourceName: "locking-nut-2-rv1.glb",
          timeSeconds: 390,
          weightGrams: 2.8,
          filamentLengthMeters: 0.94,
          materialVolumeMm3: 2241,
          dimensionsMm: { x: 52, y: 46.7, z: 30.5 },
          estimator: "stl-geometry-rough",
          assumptions: true,
        },
      },
    ],
    { group: "analysis", type: "json" },
  ),
};

const baseModel: RequestModel = {
  id: "01KSG82AH07J5ZCJ5ZMA1V62MT",
  source: "assistant:request",
  status: "draft",
  processType: "3d_printing",
  title: "Производственная заявка",
  summary: "Мне нужно распечатать 10 покемонов",
  fields,
  fieldOrder: [
    "part",
    "quantity",
    "material",
    "printTechnology",
    "color",
    "dimensions",
    "layerHeight",
    "infill",
    "finish",
    "deadline",
    "city",
    "contact",
    "file_analysis_estimates",
  ],
  files,
  missingRequired: ["material", "printTechnology", "dimensions", "contact"],
  remainingRequired: ["material", "printTechnology", "dimensions", "contact"],
  remainingDelta: [],
  completion: {
    required: 6,
    filledRequired: 2,
    total: 12,
    filledTotal: 3,
    percent: 33,
  },
  createdAt: "2026-05-26T01:48:00.000Z",
  updatedAt: now,
  revision: 2,
};

function StoryModelPreview({ alt }: { alt: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("@google/model-viewer")
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="request-estimate__empty">Загрузка viewer...</div>;
  }

  return (
    <model-viewer
      alt={alt}
      auto-rotate=""
      camera-controls=""
      src="/test.glb"
      style={{ display: "block", height: "100%", width: "100%" }}
    />
  );
}

const renderModelPreview = ({ alt }: { alt: string; fileId: string }) => (
  <StoryModelPreview alt={alt} />
);

const docsViewportCss = `
.sbdocs-content:has(.manufacturing-request-story-viewport) {
  max-width: none !important;
  width: 100% !important;
}

.sbdocs-preview:has(.manufacturing-request-story-viewport),
.docs-story:has(.manufacturing-request-story-viewport),
.sb-story:has(.manufacturing-request-story-viewport) {
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  background: #030405 !important;
}

.manufacturing-request-story-viewport {
  width: 100vw;
  max-width: none;
  min-height: 100vh;
  margin-left: calc(50% - 50vw);
  overflow: auto;
  background: #030405;
}

.sb-show-main .manufacturing-request-story-viewport {
  margin-left: 0;
}
`;

const meta = {
  title: "App/ManufacturingRequest",
  component: ManufacturingRequestPage,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <>
        <style>{docsViewportCss}</style>
        <div className="manufacturing-request-story-viewport">
          <Story />
        </div>
      </>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof ManufacturingRequestPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DraftWithGaps: Story = {
  args: {
    fileMetadata,
    model: baseModel,
    renderModelPreview,
  },
};

export const ProcessedFiles: Story = {
  args: {
    fileMetadata,
    model: {
      ...baseModel,
      status: "file_analysis_done",
      revision: 4,
      completion: {
        required: 6,
        filledRequired: 4,
        total: 12,
        filledTotal: 8,
        percent: 67,
      },
      missingRequired: ["printTechnology", "contact"],
      remainingRequired: ["printTechnology", "contact"],
    },
    renderModelPreview,
  },
};
