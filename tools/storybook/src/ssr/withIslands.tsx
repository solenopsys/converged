/**
 * Storybook decorator for testing SSR landing components.
 *
 * Two modes controlled via story parameters:
 *
 *   parameters: { ssr: 'static' }
 *     → Renders to pure static HTML (renderToStaticMarkup), no React events.
 *       Simulates exactly what the server sends to the browser.
 *
 *   parameters: { ssr: 'interactive' }
 *     → Same static HTML, then runs island mount() on [data-island] elements.
 *       Simulates what the user sees after island-client.js loads.
 *
 * Usage in a story file:
 *
 *   import { withIslands } from './ssr/withIslands';
 *
 *   export const SSRStatic: Story = {
 *     decorators: [withIslands],
 *     parameters: { ssr: 'static' },
 *   };
 *
 *   export const SSRInteractive: Story = {
 *     decorators: [withIslands],
 *     parameters: { ssr: 'interactive' },
 *   };
 */

import type { Decorator } from "@storybook/react-vite";
import React, { useEffect, useRef, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { islandRegistry } from "./island-registry";

async function activateIslands(root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>("[data-island]");
  for (const el of nodes) {
    const name = el.dataset.island;
    if (!name || el.dataset.islandMounted === "true") continue;
    const loader = islandRegistry[name];
    if (!loader) {
      console.warn(`[storybook/islands] No loader for island "${name}"`);
      continue;
    }
    try {
      el.dataset.islandMounted = "true";
      const mod = await loader();
      const props = el.dataset.islandProps ? JSON.parse(el.dataset.islandProps) : {};
      await mod.mount(el, props);
    } catch (err) {
      console.error(`[storybook/islands] Failed to mount "${name}"`, err);
      el.dataset.islandMounted = "error";
    }
  }
}

export const withIslands: Decorator = (Story, context) => {
  const mode = context.parameters.ssr as "static" | "interactive" | undefined;

  // Normal React story — no SSR simulation
  if (!mode) return <Story />;

  // Render component tree to static HTML (no event handlers = true SSR output)
  const html = renderToStaticMarkup(createElement(Story));

  if (mode === "static") {
    return (
      <div
        data-ssr-mode="static"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // 'interactive' — static HTML + island activation after mount
  return <IslandActivator html={html} />;
};

function IslandActivator({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) void activateIslands(ref.current);
  }, [html]);

  return (
    <div
      ref={ref}
      data-ssr-mode="interactive"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
