import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { ControlPanel, controlPanelOpened, controlPanelClosed, $controlPanelMode } from "front-core";
import { useUnit } from "effector-react";
import { seedControlPanel } from "./seedControlPanel";

function IntegratedControlPanel({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => { seedControlPanel({ theme }); }, [theme]);
  const mode = useUnit($controlPanelMode);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ui-background)", color: "var(--ui-foreground)", display: "flex", flexDirection: "column" }}>
      {mode === "public" ? (
        <>
          <ControlPanel />
          <div style={{ flex: 1, padding: 32, color: "var(--ui-muted-foreground)" }}>
            Landing content area
          </div>
        </>
      ) : (
        <div style={{ display: "flex", height: "100vh" }}>
          <div style={{ width: 360, flexShrink: 0, height: "100%", borderRight: "1px solid var(--ui-border)" }}>
            <ControlPanel
              chatSlot={
                <div style={{ padding: "20px 18px" }}>
                  <h3 style={{ margin: 0, fontSize: 30, lineHeight: 1.08 }}>AI Assistant</h3>
                  <p style={{ margin: "14px 0 0", opacity: 0.72 }}>Loading…</p>
                </div>
              }
            />
          </div>
          <div style={{ flex: 1, padding: 32, color: "var(--ui-muted-foreground)" }}>
            App content area — sidebar active
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => controlPanelClosed()}
                style={{
                  padding: "6px 12px", border: "1px solid var(--ui-border)",
                  borderRadius: 8, background: "transparent", color: "inherit", cursor: "pointer",
                }}
              >
                Back to landing
              </button>
            </div>
          </div>
        </div>
      )}
      {mode === "public" && (
        <button
          type="button"
          onClick={() => controlPanelOpened()}
          style={{
            position: "fixed", bottom: 20, right: 20, padding: "8px 14px",
            border: "1px solid var(--ui-border)", borderRadius: 8,
            background: "var(--ui-card)", color: "inherit", cursor: "pointer",
          }}
        >
          Open app mode
        </button>
      )}
    </div>
  );
}

const meta = {
  title: "App/IntegratedControlPanel",
  component: IntegratedControlPanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IntegratedControlPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: "dark" } };
