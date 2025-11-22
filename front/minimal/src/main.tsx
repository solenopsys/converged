import { render, addClassPlugin } from "@solenopsys/converged-renderer";
import { init_unocss, createClassPlugin } from "@solenopsys/converged-style";
import {
  UiButton,
  UiTooltip,
  DunText,
  UiCard,
  UiCardHeader,
  UiCardTitle,
  UiCardDescription,
  UiCardContent,
  UiCardFooter,
  UiInput,
  VirtualTable,
  type Column,
} from "./ui";
import { type Mail } from "./generated";
import { mailsData, loadMore, tableReady } from "./store/mails";

// Initialize UnoCSS with class plugin
addClassPlugin(createClassPlugin());
await init_unocss({
  theme: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: {
        DEFAULT: "var(--card)",
        foreground: "var(--card-foreground)",
      },
      popover: {
        DEFAULT: "var(--popover)",
        foreground: "var(--popover-foreground)",
      },
      primary: {
        DEFAULT: "var(--primary)",
        foreground: "var(--primary-foreground)",
      },
      secondary: {
        DEFAULT: "var(--secondary)",
        foreground: "var(--secondary-foreground)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-foreground)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        foreground: "var(--accent-foreground)",
      },
      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-foreground)",
      },
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
      chart: {
        1: "var(--chart-1)",
        2: "var(--chart-2)",
        3: "var(--chart-3)",
        4: "var(--chart-4)",
        5: "var(--chart-5)",
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

const TOTAL_COUNT = 250000;

const mailColumns: Column<Mail>[] = [
  { key: "id", header: "ID", width: 80 },
  { key: "subject", header: "Subject", width: 300 },
  { key: "sender", header: "From", width: 200 },
  { key: "recipient", header: "To", width: 200 },
  { key: "date", header: "Date", width: 150 },
];

function App() {
  const handleClick = () => {
    console.log("Button clicked!");
    alert("Button works!");
  };

  const handleRowClick = (item: Mail, index: number) => {
    console.log(`Clicked row ${index}:`, item);
    alert(`Selected: ${item.subject} from ${item.sender}`);
  };

  return (
    <div class="p-8 flex flex-col gap-4 items-start">
      <h1 class="text-2xl font-bold mb-4">Zag + Voby Button Demo</h1>

      <div class="flex gap-2 flex-wrap">
        <UiButton variant="primary" onClick={handleClick}>
          Primary
        </UiButton>

        <UiButton variant="secondary" onClick={handleClick}>
          Secondary
        </UiButton>

        <UiButton variant="ghost" onClick={handleClick}>
          Ghost
        </UiButton>

        <UiButton variant="destructive" onClick={handleClick}>
          Destructive
        </UiButton>
      </div>

      <div class="flex gap-2 items-center">
        <UiButton size="sm">Small</UiButton>
        <UiButton size="md">Medium</UiButton>
        <UiButton size="lg">Large</UiButton>
      </div>

      <UiButton disabled>Disabled</UiButton>

      <div class="mt-4">
        <UiTooltip content="This is a tooltip with a very long text that should wrap properly and not stretch across the entire screen width">
          Hover me for long tooltip
        </UiTooltip>
      </div>

      <div class="mt-4">
        <DunText buttonText="Show" content="EXTERNAL" />
      </div>

      <div class="mt-8 w-full max-w-md">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Card Title</UiCardTitle>
            <UiCardDescription>Card description goes here</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <div class="flex flex-col gap-2">
              <UiInput placeholder="Enter your name" />
              <UiInput type="email" placeholder="Enter your email" />
            </div>
          </UiCardContent>
          <UiCardFooter>
            <UiButton variant="outline" size="sm">
              Cancel
            </UiButton>
            <UiButton size="sm" className="ml-2">
              Save
            </UiButton>
          </UiCardFooter>
        </UiCard>
      </div>

      {/* Virtual Table Demo */}
      <div class="mt-8 w-full">
        <h2 class="text-xl font-bold mb-4">
          Warm Mails ({mailsData.length} / {TOTAL_COUNT})
        </h2>
        <div class="border rounded-lg overflow-hidden">
          <VirtualTable
            data={mailsData}
            columns={mailColumns}
            height={400}
            rowHeight={40}
            overscan={5}
            onRowClick={handleRowClick}
            onLoadMore={() => loadMore()}
            totalCount={TOTAL_COUNT}
            onMount={(api) => tableReady(api)}
          />
        </div>
      </div>
    </div>
  );
}

render(<App />, document.getElementById("app")!);
