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
			landing: {
				canvas: "var(--landing-canvas)",
				"canvas-muted": "var(--landing-canvas-muted)",
				surface: "var(--landing-surface)",
				ink: "var(--landing-ink)",
				"ink-strong": "var(--landing-ink-strong)",
				"ink-muted": "var(--landing-ink-muted)",
				"ink-subtle": "var(--landing-ink-subtle)",
				line: "var(--landing-line)",
				accent: "var(--landing-accent)",
			},
    },
  },
});
