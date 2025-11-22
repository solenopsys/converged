export * from "./browser/class-injector";
export * from "./browser/styles-injector";

import { createGenerator } from "@unocss/core";
import presetWind3 from "@unocss/preset-wind3";

const classes = new Set<string>();
let generator: any = null;
let styleElement: HTMLStyleElement | null = null;
let updateScheduled = false;

function registerClasses(className: string) {
  console.log("[UnoCSS] Registering:", className);
  className.split(/\s+/).forEach((c) => {
    if (c) classes.add(c);
  });
}

async function updateStyles() {
  if (!generator || !styleElement) return;

  console.log("[UnoCSS] Generating CSS for", classes.size, "classes");
  const result = await generator.generate([...classes]);
  console.log("[UnoCSS] Generated", result.css.length, "bytes");
  styleElement.textContent = result.css;
}

function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(async () => {
    await updateStyles();
    updateScheduled = false;
  });
}

export function createClassPlugin() {
  return (_element: HTMLElement, className: string) => {
    registerClasses(className);
    scheduleUpdate();
  };
}

export async function init_unocss(options?: { theme?: Record<string, any> }) {
  generator = await createGenerator({
    presets: [presetWind3()],
    theme: options?.theme,
  });

  styleElement = document.createElement("style");
  styleElement.id = "unocss-generated";
  document.head.appendChild(styleElement);
}
