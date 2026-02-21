import {
  defineConfig,
  presetAttributify,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss";
import { presetWind4 } from "unocss/preset-wind4";

export default defineConfig({
  content: {
    filesystem: [
      "src/**/*.{tsx,ts}",
      "../../front/front-core/src/**/*.{tsx,ts}",
      "../../front/microfrontends/mf-assistants/src/**/*.{tsx,ts}",
"../../../../../saas/public/front/front-landings/src/**/*.{tsx,ts}",
      "../../../../../saas/private/landing/app/**/*.{tsx,ts}",
      "../../../../../saas/private/landing/components/**/*.{tsx,ts}",
    ],
  },
  envMode: process.env.NODE_ENV === "production" ? "build" : "dev",
  transformers: [transformerDirectives(), transformerVariantGroup()],
  presets: [
    presetWind4(),
    presetAttributify({
      strict: true,
      prefix: "un-",
      prefixedOnly: false,
    }),
    presetIcons({
      scale: 1.2,
      cdn: "https://esm.sh/",
    }),
  ],
  blocklist: [/^\?$/, /^\\\?$/, /^dark\$\$/],
  theme: {
    fontFamily: {
      sans: ["var(--font-geist-sans)", "sans-serif"],
      mono: ["var(--font-geist-mono)", "monospace"],
    },
    colors: {
      border: "var(--ui-border)",
      input: "var(--ui-input)",
      ring: "var(--ui-ring)",
      background: "var(--ui-background)",
      foreground: "var(--ui-foreground)",
      primary: {
        DEFAULT: "var(--ui-primary)",
        foreground: "var(--ui-primary-foreground)",
      },
      secondary: {
        DEFAULT: "var(--ui-secondary)",
        foreground: "var(--ui-secondary-foreground)",
      },
      destructive: {
        DEFAULT: "var(--ui-destructive)",
        foreground: "var(--ui-destructive-foreground)",
      },
      success: {
        DEFAULT: "var(--ui-success)",
        foreground: "var(--ui-success-foreground)",
      },
      muted: {
        DEFAULT: "var(--ui-muted)",
        foreground: "var(--ui-muted-foreground)",
      },
      accent: {
        DEFAULT: "var(--ui-accent)",
        foreground: "var(--ui-accent-foreground)",
      },
      popover: {
        DEFAULT: "var(--ui-popover)",
        foreground: "var(--ui-popover-foreground)",
      },
      card: {
        DEFAULT: "var(--ui-card)",
        foreground: "var(--ui-card-foreground)",
      },
      sidebar: {
        DEFAULT: "var(--ui-sidebar)",
        foreground: "var(--ui-sidebar-foreground)",
        primary: {
          DEFAULT: "var(--ui-sidebar-primary)",
          foreground: "var(--ui-sidebar-primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--ui-sidebar-accent)",
          foreground: "var(--ui-sidebar-accent-foreground)",
        },
        border: "var(--ui-sidebar-border)",
        ring: "var(--ui-sidebar-ring)",
      },
    },
    borderRadius: {
      sm: "calc(var(--radius) - 4px)",
      md: "calc(var(--radius) - 2px)",
      lg: "var(--radius)",
      xl: "calc(var(--radius) + 4px)",
    },
  },
});
