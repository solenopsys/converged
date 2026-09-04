import { defineConfig, transformerVariantGroup } from "unocss";
import { presetWind4 } from "unocss/preset-wind4";


export default defineConfig({
	transformers: [transformerVariantGroup()],
	presets: [presetWind4({ dark: "class", colorSpace: "oklch" })],
	theme: {
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
			warning: {
				DEFAULT: "var(--ui-warning)",
				foreground: "var(--ui-warning-foreground)",
			},
			info: {
				DEFAULT: "var(--ui-info)",
				foreground: "var(--ui-info-foreground)",
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
			chart: {
				1: "var(--ui-chart-1)",
				2: "var(--ui-chart-2)",
				3: "var(--ui-chart-3)",
				4: "var(--ui-chart-4)",
				5: "var(--ui-chart-5)",
				6: "var(--ui-chart-6)",
				7: "var(--ui-chart-7)",
				8: "var(--ui-chart-8)",
			},
		},
		radius: {
			sm: "calc(var(--radius) - 4px)",
			md: "calc(var(--radius) - 2px)",
			lg: "var(--radius)",
			xl: "calc(var(--radius) + 4px)",
		},
	},
});
