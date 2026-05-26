import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { KeyRound, Settings2, ShoppingBag } from "lucide-react";
import { ConvergedRailPanelIntegration, tabsSet } from "front-core";
import { seedControlPanel } from "./seedControlPanel";

// User-defined tabs. The chat tab is implicit and always first.
const tabs = [
  { id: "login", icon: <KeyRound size={17} />, label: "Login" },
  { id: "orders", icon: <ShoppingBag size={17} />, label: "Orders" },
  { id: "settings", icon: <Settings2 size={17} />, label: "Settings" },
];

function DemoLoginForm() {
  return (
    <form style={{ display: "grid", gap: 12, maxWidth: 320 }} onSubmit={(e) => e.preventDefault()}>
      <h3 style={{ margin: 0, fontSize: 20 }}>Sign in</h3>
      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--ui-muted-foreground)" }}>
        Email
        <input
          type="email"
          placeholder="you@example.com"
          style={{ height: 36, padding: "0 12px", border: "1px solid var(--ui-border)", borderRadius: 8, background: "var(--ui-muted)", color: "inherit" }}
        />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--ui-muted-foreground)" }}>
        Password
        <input
          type="password"
          placeholder="••••••••"
          style={{ height: 36, padding: "0 12px", border: "1px solid var(--ui-border)", borderRadius: 8, background: "var(--ui-muted)", color: "inherit" }}
        />
      </label>
      <button
        type="submit"
        style={{ height: 36, border: 0, borderRadius: 8, background: "var(--ui-foreground)", color: "var(--ui-background)", fontWeight: 700, cursor: "pointer" }}
      >
        Continue
      </button>
    </form>
  );
}

function DemoOrdersForm() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 20 }}>Orders</h3>
      {["#A-1042", "#A-1041", "#A-1037"].map((id) => (
        <div key={id} style={{ padding: 12, border: "1px solid var(--ui-border)", borderRadius: 8, background: "var(--ui-muted)" }}>
          <div style={{ fontWeight: 700 }}>{id}</div>
          <div style={{ fontSize: 12, color: "var(--ui-muted-foreground)", marginTop: 4 }}>turning · 12 pcs · due in 4 days</div>
        </div>
      ))}
    </div>
  );
}

function DemoSettingsForm() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 20 }}>Settings</h3>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Email notifications</span>
        <input type="checkbox" defaultChecked />
      </label>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Sound alerts</span>
        <input type="checkbox" />
      </label>
    </div>
  );
}

const tabContents = {
  login: <DemoLoginForm />,
  orders: <DemoOrdersForm />,
  settings: <DemoSettingsForm />,
};

function PanelStory({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    seedControlPanel({ theme });
    tabsSet(tabs);
  }, [theme]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--ui-background)" }}>
      <div style={{
        width: 360,
        flexShrink: 0,
        height: "100%",
        borderRight: "1px solid color-mix(in oklch, var(--ui-border) 74%, transparent)",
        overflow: "hidden",
      }}>
        <ConvergedRailPanelIntegration
          chatSlot={
            <div style={{ padding: "20px 18px" }}>
              <h3 style={{ margin: 0, fontSize: 30, lineHeight: 1.08 }}>AI Assistant</h3>
              <p style={{ margin: "14px 0 0", opacity: 0.72 }}>Loading…</p>
            </div>
          }
          tabContents={tabContents}
        />
      </div>
      <div style={{ flex: 1, padding: 24, color: "var(--ui-muted-foreground)", fontSize: 14 }}>
        Main content area
      </div>
    </div>
  );
}

const meta = {
  title: "App/ControlPanel",
  component: PanelStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = { args: { theme: "dark" }, globals: { theme: "dark" } };
export const Light: Story = { args: { theme: "light" }, globals: { theme: "light" } };
