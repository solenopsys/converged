import React, { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "auto-rotate"?: boolean | "";
        "camera-controls"?: boolean | "";
        "shadow-intensity"?: string;
        "environment-image"?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

function ModelViewerUrl({
  src,
  height = 480,
  background = "#1a1a2e",
}: {
  src: string;
  height?: number;
  background?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("@google/model-viewer")
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height,
        background,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ready ? (
        <model-viewer
          src={src}
          alt="3D model"
          auto-rotate=""
          camera-controls=""
          shadow-intensity="1"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <span style={{ color: "#888", fontSize: 14 }}>Loading model-viewer...</span>
      )}
    </div>
  );
}

const meta = {
  title: "Components/ModelViewer",
  component: ModelViewerUrl,
  parameters: { layout: "padded" },
  argTypes: {
    background: { control: "color" },
    height: { control: { type: "range", min: 200, max: 800, step: 20 } },
  },
} satisfies Meta<typeof ModelViewerUrl>;

export default meta;
type Story = StoryObj<typeof meta>;

// Локальный GLB — минимальная сцена с треугольником (лежит в storybook/public/test.glb)
export const LocalGlb: Story = {
  name: "Локальный GLB (треугольник)",
  args: {
    src: "/test.glb",
    height: 480,
    background: "#0f172a",
  },
};

// Образцы от google/model-viewer для проверки что рендеринг вообще работает
export const Astronaut: Story = {
  name: "Астронавт (CDN)",
  args: {
    src: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    height: 480,
    background: "#0f172a",
  },
};
