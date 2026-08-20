import { defineConfig, presetMini, transformerVariantGroup } from "unocss";


export default defineConfig({
  presets: [
    presetMini({ dark: "class" }),
  ],
  transformers: [transformerVariantGroup()],
  theme: {
    colors: {
      canvas: "var(--hw-canvas)",
      ink: "var(--hw-ink)",
      "ink-muted": "var(--hw-ink-muted)",
      line: "var(--hw-panel-border)",
      signal: "var(--hw-focus)",
    },
  },
});
