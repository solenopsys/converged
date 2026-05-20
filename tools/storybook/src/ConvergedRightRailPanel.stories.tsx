import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Columns2,
  Globe2,
  LogIn,
  MessageSquare,
  PackageCheck,
  PanelLeftClose,
  Send,
  Sun,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChatDetail } from "mf-assistants";
import { Button, Textarea } from "front-core";
import { preSsrShellCss } from "../../../front/front-core/src/landing-common/ssr-shell";

type ThemeMode = "light" | "dark";

type OpenScreen = {
  id: string;
  label: string;
  detail?: string;
  icon: ReactNode;
};

type QuickAction = {
  id: string;
  label: string;
  prompt: string;
  icon: ReactNode;
};

const initialScreens: OpenScreen[] = [
  { id: "feed", label: "Feed", icon: <Activity aria-hidden="true" size={18} /> },
  { id: "orders", label: "Orders", icon: <PackageCheck aria-hidden="true" size={18} /> },
  {
    id: "ivanov",
    label: "Ivanov",
    detail: "turning",
    icon: <Wrench aria-hidden="true" size={18} />,
  },
];

const quickActions: QuickAction[] = [
  {
    id: "check-drawing",
    label: "Check drawing",
    prompt: "Check the drawing for the open order and list production risks.",
    icon: <BadgeCheck aria-hidden="true" size={16} />,
  },
  {
    id: "upload-file",
    label: "Upload file",
    prompt: "Prepare a file upload for the current order and show which data is required.",
    icon: <Upload aria-hidden="true" size={16} />,
  },
  {
    id: "estimate-deadline",
    label: "Estimate deadline",
    prompt: "Estimate the deadline for Ivanov's turning order: material, tolerances, and part count.",
    icon: <CalendarClock aria-hidden="true" size={16} />,
  },
];

const messages = [
  {
    id: "assistant-1",
    type: "assistant" as const,
    content:
      "Two requests arrived this morning: aluminum turning and an urgent 3D printed housing. Ivanov's order is already open.",
    timestamp: Date.now() - 1000 * 60 * 9,
  },
  {
    id: "user-1",
    type: "user" as const,
    content: "Show what is missing for Ivanov's estimate.",
    timestamp: Date.now() - 1000 * 60 * 7,
  },
  {
    id: "assistant-2",
    type: "assistant" as const,
    content:
      "Material, fit diameter tolerance, and part quantity are missing. I can send the client a short clarification question.",
    timestamp: Date.now() - 1000 * 60 * 6,
  },
];

function PanelControls({
  languageOpen,
  onLanguageToggle,
}: {
  languageOpen: boolean;
  onLanguageToggle: () => void;
}) {
  return (
    <div className="ssr-panel-controls unified-rail-controls" aria-label="Panel controls">
      <Button className="ssr-panel-control" size="icon" type="button" variant="ghost" aria-label="Open login">
        <LogIn aria-hidden="true" size={17} />
      </Button>
      <Button className="ssr-panel-control" size="icon" type="button" variant="ghost" aria-label="Toggle theme">
        <Sun aria-hidden="true" size={17} />
      </Button>
      <div className="ssr-lang-control" data-open={languageOpen ? "1" : "0"} data-ssr-lang-root="">
        <Button
          aria-expanded={languageOpen}
          aria-label="Language"
          className="ssr-panel-control ssr-lang-trigger"
          onClick={onLanguageToggle}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Globe2 aria-hidden="true" size={16} />
          <span className="ssr-lang-current">EN</span>
        </Button>
        <div className="ssr-lang-popover" role="menu">
          <button className="ssr-lang-option is-active" type="button">
            EN
          </button>
          <button className="ssr-lang-option" type="button">
            RU
          </button>
        </div>
      </div>
      <Button className="ssr-panel-control" size="icon" type="button" variant="ghost" aria-label="Collapse panel">
        <PanelLeftClose aria-hidden="true" size={17} />
      </Button>
      <Button
        aria-pressed="true"
        className="ssr-right-rail-tab-btn"
        size="icon"
        type="button"
        variant="ghost"
        aria-label="AI panel"
      >
        <MessageSquare aria-hidden="true" size={17} />
      </Button>
      <Button
        aria-pressed="false"
        className="ssr-right-rail-tab-btn"
        size="icon"
        type="button"
        variant="ghost"
        aria-label="Form panel"
      >
        <Columns2 aria-hidden="true" size={17} />
      </Button>
    </div>
  );
}

function OpenScreensList({
  screens,
  activeScreenId,
  onActiveScreenChange,
  onCloseScreen,
}: {
  screens: OpenScreen[];
  activeScreenId: string;
  onActiveScreenChange: (id: string) => void;
  onCloseScreen: (id: string) => void;
}) {
  return (
    <section className="unified-open-screens" aria-label="Open screens">
      <h2 className="unified-section-title">Open screens</h2>
      <div className="unified-open-screen-list">
        {screens.map((screen) => (
          <div
            className="unified-open-screen"
            data-active={screen.id === activeScreenId ? "1" : "0"}
            key={screen.id}
          >
            <Button
              className="unified-open-screen-button"
              onClick={() => onActiveScreenChange(screen.id)}
              type="button"
              variant="ghost"
            >
              <span className="unified-open-screen-icon">{screen.icon}</span>
              <span className="unified-open-screen-label">{screen.label}</span>
              {screen.detail ? <span className="unified-open-screen-detail">{screen.detail}</span> : null}
              <span
                aria-label={`Close ${screen.label}`}
                className="unified-open-screen-close"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseScreen(screen.id);
                }}
                role="button"
                tabIndex={-1}
              >
                <X aria-hidden="true" size={14} />
              </span>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActions({
  actions,
  onAction,
}: {
  actions: QuickAction[];
  onAction: (prompt: string) => void;
}) {
  return (
    <div className="unified-quick-actions" aria-label="Quick actions">
      {actions.map((action) => (
        <Button
          className="ssr-chat-quick-btn unified-quick-action"
          key={action.id}
          onClick={() => onAction(action.prompt)}
          type="button"
          variant="outline"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function ChatComposer({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <footer id="ssr-chat-dock" className="unified-composer-dock">
      <form
        id="ssr-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Button id="ssr-chat-attach" size="icon" type="button" variant="ghost" aria-label="Attach file">
          <Upload aria-hidden="true" size={17} />
        </Button>
        <Textarea
          id="ssr-chat-input"
          aria-label="AI chat input"
          className="unified-composer-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe your CNC request..."
          rows={1}
          value={value}
        />
        <Button id="ssr-chat-send" size="icon" type="submit" variant="ghost" aria-label="Send message">
          <Send aria-hidden="true" size={17} />
        </Button>
      </form>
    </footer>
  );
}

function UnifiedRailStory({ theme = "dark" }: { theme?: ThemeMode }) {
  const [screens, setScreens] = useState(initialScreens);
  const [activeScreenId, setActiveScreenId] = useState(initialScreens[0]?.id ?? "");
  const [composerValue, setComposerValue] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);

  const closeScreen = (id: string) => {
    setScreens((current) => {
      const next = current.filter((screen) => screen.id !== id);
      if (activeScreenId === id) setActiveScreenId(next[0]?.id ?? "");
      return next;
    });
  };

  return (
    <div className={theme === "dark" ? "storybook-unified-stage dark" : "storybook-unified-stage"} data-theme={theme}>
      <style>{preSsrShellCss}</style>
      <style>{unifiedRailCss}</style>
      <section className="unified-rail" aria-label="Converged AI unified panel">
        <header className="ssr-panel-head unified-rail-head">
          <div className="unified-rail-brand">
            <img className="unified-rail-logo unified-rail-logo-light" src="/landing/header-logo-black.svg" alt="Converged AI" />
            <img className="unified-rail-logo unified-rail-logo-dark" src="/landing/header-logo-white.svg" alt="Converged AI" />
          </div>
          <PanelControls
            languageOpen={languageOpen}
            onLanguageToggle={() => setLanguageOpen((current) => !current)}
          />
        </header>

        <aside className="unified-rail-menu">
          <OpenScreensList
            activeScreenId={activeScreenId}
            screens={screens}
            onActiveScreenChange={setActiveScreenId}
            onCloseScreen={closeScreen}
          />
          <QuickActions actions={quickActions} onAction={setComposerValue} />
        </aside>

        <section className="unified-rail-chat" aria-label="AI chat">
          <div className="unified-chat-body">
            <ChatDetail
              messages={messages}
              isLoading={false}
              currentResponse=""
              send={(content: string) => setComposerValue(content)}
              showComposer={false}
            />
          </div>
        </section>

        <ChatComposer value={composerValue} onChange={setComposerValue} onSubmit={() => setComposerValue("")} />
      </section>
    </div>
  );
}

const unifiedRailCss = `
.storybook-unified-stage {
  --unified-radius: 10px;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--ui-background);
  color: var(--ui-foreground);
  padding: 24px;
}

.storybook-unified-stage[data-theme="light"] {
  color-scheme: light;
  --ui-background: oklch(1 0 0);
  --ui-foreground: oklch(0.141 0.005 285.823);
  --ui-card: oklch(1 0 0);
  --ui-card-foreground: oklch(0.141 0.005 285.823);
  --ui-muted: oklch(0.967 0.001 286.375);
  --ui-muted-foreground: oklch(0.552 0.016 285.938);
  --ui-border: oklch(0.92 0.004 286.32);
  --background: var(--ui-background);
  --foreground: var(--ui-foreground);
  --card: var(--ui-card);
  --card-foreground: var(--ui-card-foreground);
  --muted: var(--ui-muted);
  --muted-foreground: var(--ui-muted-foreground);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --accent: var(--ui-muted);
  --accent-foreground: var(--ui-foreground);
}

.storybook-unified-stage[data-theme="dark"] {
  color-scheme: dark;
  --ui-background: oklch(0.141 0.005 285.823);
  --ui-foreground: oklch(0.985 0 0);
  --ui-card: oklch(0.21 0.006 285.885);
  --ui-card-foreground: oklch(0.985 0 0);
  --ui-muted: oklch(0.274 0.006 286.033);
  --ui-muted-foreground: oklch(0.705 0.015 286.067);
  --ui-border: oklch(1 0 0 / 10%);
  --background: var(--ui-background);
  --foreground: var(--ui-foreground);
  --card: var(--ui-card);
  --card-foreground: var(--ui-card-foreground);
  --muted: var(--ui-muted);
  --muted-foreground: var(--ui-muted-foreground);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --accent: var(--ui-muted);
  --accent-foreground: var(--ui-foreground);
}

.unified-rail {
  width: min(calc(100vw - 48px), 360px);
  height: 820px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 54px auto minmax(0, 1fr) 64px;
  overflow: hidden;
  border: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  background: var(--ui-card);
}

.unified-rail-menu {
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
  min-height: auto;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  background: transparent;
}

.unified-rail-chat {
  grid-column: 1;
  grid-row: 3;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.unified-rail #ssr-chat-dock.unified-composer-dock {
  grid-column: 1;
  grid-row: 4;
  width: auto;
  display: block;
  padding: 10px 12px;
  border-top: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  background: color-mix(in oklch, var(--ui-card) 92%, transparent);
}

.unified-rail-head {
  grid-column: 1;
  grid-row: 1;
  justify-content: space-between;
  min-height: 54px;
  padding: 10px 14px;
}

.unified-rail-brand {
  min-width: 0;
  display: flex;
  align-items: center;
}

.unified-rail-logo {
  width: 96px;
  height: 34px;
  object-fit: contain;
  object-position: left center;
}

.unified-rail-logo-dark {
  display: none;
}

.storybook-unified-stage[data-theme="dark"] .unified-rail-logo-light {
  display: none;
}

.storybook-unified-stage[data-theme="dark"] .unified-rail-logo-dark {
  display: block;
}

.unified-rail-controls {
  flex: 0 0 auto;
  gap: 4px;
}

.unified-rail .ssr-panel-control,
.unified-rail .ssr-right-rail-tab-btn {
  width: 28px;
  height: 28px;
  border-color: transparent;
  border-radius: 7px;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.unified-rail .ssr-lang-trigger {
  width: auto;
  min-width: 46px;
  padding: 0 6px;
}

.unified-rail .ssr-panel-control:hover,
.unified-rail .ssr-right-rail-tab-btn:hover,
.unified-rail .ssr-right-rail-tab-btn[aria-pressed="true"] {
  border-color: color-mix(in oklch, var(--ui-border) 64%, transparent);
  background: color-mix(in oklch, var(--ui-muted) 56%, transparent);
}

.unified-open-screens {
  padding: 18px 12px 10px;
}

.unified-section-title {
  margin: 0 0 12px;
  padding: 0 8px;
  color: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.unified-open-screen-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.unified-open-screen {
  display: block;
}

.unified-open-screen-button {
  min-width: 0;
  width: 100%;
  height: 32px;
  justify-content: flex-start;
  gap: 10px;
  border-radius: var(--unified-radius);
  padding: 0 8px;
  background: transparent;
  color: var(--ui-foreground);
}

.unified-open-screen[data-active="1"] .unified-open-screen-button {
  background: color-mix(in oklch, var(--ui-muted) 82%, transparent);
}

.unified-open-screen-icon {
  width: 17px;
  height: 17px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
}

.unified-open-screen-label {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unified-open-screen-detail {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: color-mix(in oklch, var(--ui-foreground) 54%, transparent);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unified-open-screen-close {
  width: 24px;
  height: 24px;
  display: inline-grid;
  flex: 0 0 auto;
  margin-left: auto;
  opacity: 0;
  place-items: center;
  border-radius: calc(var(--unified-radius) - 3px);
  color: color-mix(in oklch, var(--ui-foreground) 48%, transparent);
  cursor: pointer;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}

.unified-open-screen:hover .unified-open-screen-close,
.unified-open-screen:focus-within .unified-open-screen-close {
  opacity: 1;
}

.unified-open-screen-close:hover {
  background: color-mix(in oklch, var(--ui-muted) 68%, transparent);
  color: var(--ui-foreground);
}

.unified-quick-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 12px;
}

.unified-quick-action {
  width: 100%;
  min-height: 34px;
  justify-content: flex-start;
  border-radius: var(--unified-radius);
  padding: 7px 11px;
  font-size: 13px;
  font-weight: 600;
}

.unified-chat-body {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding-top: 10px;
}

.unified-chat-body [data-slot="chat-detail"],
.unified-chat-body .h-full {
  height: 100%;
}

.unified-chat-body :where(p, span, div) {
  font-size: 14px;
  line-height: 1.42;
}

.unified-composer-dock #ssr-chat-form {
  min-height: 42px;
}

.unified-composer-input {
  min-height: 20px;
  height: 20px;
  resize: none;
  border: 0;
  box-shadow: none;
  padding: 0;
  background: transparent;
}

@media (max-width: 640px) {
  .storybook-unified-stage {
    padding: 0;
  }

  .unified-rail {
    width: 100vw;
    height: 100vh;
  }
}
`;

const meta = {
  title: "Prototypes/ConvergedRightRailPanel",
  component: UnifiedRailStory,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof UnifiedRailStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
};

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
};
