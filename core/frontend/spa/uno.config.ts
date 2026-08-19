import { defineConfig, presetMini, transformerVariantGroup } from "unocss";

/**
 * Утилитарный слой оболочки. Разметка оболочки и лендинга написана
 * семантическими классами (`front-core/src/styles/*.css`), поэтому пресет здесь
 * нужен ради препрефлайта и редких раскладочных утилит, а не ради палитры.
 *
 * Цвета объявлены ссылками на токены, а не литералами: значение, вписанное
 * сюда, `:root.dark` уже не перебьёт — утилита осталась бы светлой в тёмной
 * теме. Литералы живут ровно в одном файле — `styles/tokens.css`.
 */
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
