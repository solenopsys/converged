import {
  createGenerator,
  type UserConfig,
  type UnoGenerator,
} from "@unocss/core";
import presetWind3 from "@unocss/preset-wind3";
import { getClasses } from "./class-registry";

let generator: UnoGenerator | null = null;
let styleElement: HTMLStyleElement | null = null;
let updateScheduled = false;

export async function initGenerator(options?: { theme?: Record<string, any> }) {
  const config: UserConfig = {
    presets: [presetWind3()],
    theme: options?.theme,
  };

  generator = createGenerator(config);

  // Create style element
  styleElement = document.createElement("style");
  styleElement.id = "unocss-runtime";
  document.head.appendChild(styleElement);
}

export async function generateCSS(): Promise<string> {
  if (!generator) {
    throw new Error("Generator not initialized. Call initGenerator first.");
  }

  const classes = getClasses();
  const result = await generator.generate(classes);
  return result.css;
}

export async function updateStyles() {
  if (!styleElement) return;

  const css = await generateCSS();
  styleElement.textContent = css;
}

// Debounced update for batching multiple class registrations
export function scheduleUpdate() {
  if (updateScheduled) return;

  updateScheduled = true;
  requestAnimationFrame(async () => {
    await updateStyles();
    updateScheduled = false;
  });
}
