import type { Preview } from "@storybook/react-vite";
import React from "react";
import { ComponentInspector } from "front-core";
import * as FrontCoreExports from "front-core";

const knownComponents = new Set<Function>(
  Object.values(FrontCoreExports).filter((v): v is Function => typeof v === "function")
);
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "../../../front/ssr/src/app/globals.css";
import "../src/storybook-overrides.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme",
      defaultValue: "dark",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const selected = context.globals.theme as "light" | "dark" | "system";
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const effective = selected === "system" ? (prefersDark ? "dark" : "light") : selected;

      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", effective === "dark");
      }

      return (
        <>
          <Story />
          <ComponentInspector known={knownComponents} />
        </>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
