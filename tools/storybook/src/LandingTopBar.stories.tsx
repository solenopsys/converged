import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Globe2,
  LogIn,
  PackageCheck,
  Paperclip,
  Phone,
  Ruler,
  Send,
  Sun,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button, Textarea } from "front-core";
import { preSsrShellCss } from "../../../front/front-core/src/landing-common/ssr-shell";

type ThemeMode = "light" | "dark";

const magicActions: Array<{ icon: LucideIcon; label: string; prompt: string }> = [
  { icon: BadgeCheck, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: Upload, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: CalendarClock, label: "Estimate deadline", prompt: "Estimate deadline for this request: " },
  { icon: ClipboardCheck, label: "Request quote", prompt: "Prepare a quote for this request: " },
  { icon: PackageCheck, label: "Choose material", prompt: "Help me choose material for this part: " },
  { icon: Ruler, label: "Check tolerances", prompt: "Check tolerances for this part: " },
];

function LandingTopBarStory({ theme = "light" }: { theme?: ThemeMode }) {
  const [value, setValue] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <div className={theme === "dark" ? "landing-topbar-story dark" : "landing-topbar-story"} data-theme={theme}>
      <style>{preSsrShellCss}</style>
      <style>{landingTopBarCss}</style>
      <header className="landing-topbar" aria-label="Landing chat top bar">
        <div className="landing-topbar-brand">
          <img className="landing-topbar-logo landing-topbar-logo-light" src="/landing/header-logo-black.svg" alt="Converged AI" />
          <img className="landing-topbar-logo landing-topbar-logo-dark" src="/landing/header-logo-white.svg" alt="Converged AI" />
          <a className="landing-topbar-phone" href="tel:+78005553535">
            <Phone aria-hidden="true" size={12} />
            +7 (800) 555-35-35
          </a>
          <div className="landing-topbar-status">
            <span aria-hidden="true" />
            OPEN · UNTIL 18:00
          </div>
        </div>

        <div className="landing-topbar-chat">
          <form
            className="landing-topbar-form"
            onSubmit={(event) => {
              event.preventDefault();
              setValue("");
            }}
          >
            <Textarea
              aria-label="Ask Convo"
              className="landing-topbar-input"
              onChange={(event) => setValue(event.target.value)}
              placeholder="ask convo anything..."
              rows={1}
              value={value}
            />
            <Button className="landing-topbar-attach" size="icon" type="button" variant="ghost" aria-label="Attach file">
              <Paperclip aria-hidden="true" size={15} />
            </Button>
            <Button className="landing-topbar-send" size="icon" type="submit" variant="ghost" aria-label="Send message">
              <Send aria-hidden="true" size={15} />
            </Button>
          </form>
        </div>

        <div className="landing-topbar-controls" aria-label="Landing controls">
          <div className="ssr-lang-control" data-open={languageOpen ? "1" : "0"} data-ssr-lang-root="">
            <Button
              aria-expanded={languageOpen}
              aria-label="Language"
              className="ssr-panel-control landing-topbar-icon-control"
              onClick={() => setLanguageOpen((current) => !current)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Globe2 aria-hidden="true" size={15} />
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
          <Button className="ssr-panel-control landing-topbar-icon-control" size="icon" type="button" variant="ghost" aria-label="Toggle theme">
            <Sun aria-hidden="true" size={15} />
          </Button>
          <Button className="landing-topbar-login" type="button">
            <LogIn aria-hidden="true" size={14} />
            log in
          </Button>
        </div>

        <div className="landing-topbar-phrases" aria-label="Magic phrases">
          {magicActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                className="landing-topbar-phrase"
                key={action.label}
                onClick={() => setValue(action.prompt)}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden="true" size={14} />
                {action.label}
              </Button>
            );
          })}
        </div>
      </header>
    </div>
  );
}

const landingTopBarCss = `
.landing-topbar-story {
  min-height: 100vh;
  background: var(--topbar-page);
  color: var(--topbar-ink);
  padding: 0;
}

.landing-topbar-story[data-theme="light"] {
  color-scheme: light;
  --topbar-page: #f7f7f6;
  --topbar-surface: #fbfbfa;
  --topbar-field: #f1f1f0;
  --topbar-chip: #fff;
  --topbar-ink: #1d1d1f;
  --topbar-muted: #6f7076;
  --topbar-border: #dadad7;
  --topbar-control-hover: #eeeeeb;
  --topbar-send: #a9a9a7;
  --topbar-login: #111113;
  --ui-background: oklch(1 0 0);
  --ui-foreground: oklch(0.141 0.005 285.823);
  --ui-card: oklch(1 0 0);
  --ui-muted: oklch(0.967 0.001 286.375);
  --ui-border: oklch(0.92 0.004 286.32);
  --background: var(--ui-background);
  --foreground: var(--ui-foreground);
  --card: var(--ui-card);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --accent: var(--ui-muted);
  --accent-foreground: var(--ui-foreground);
}

.landing-topbar-story[data-theme="dark"] {
  color-scheme: dark;
  --topbar-page: #050506;
  --topbar-surface: #111113;
  --topbar-field: #1b1b1e;
  --topbar-chip: #0c0c0d;
  --topbar-ink: #f2f2f3;
  --topbar-muted: #a2a3aa;
  --topbar-border: #2a2a2d;
  --topbar-control-hover: #202024;
  --topbar-send: #3b3b3f;
  --topbar-login: #f4f4f5;
  --ui-background: oklch(0.141 0.005 285.823);
  --ui-foreground: oklch(0.985 0 0);
  --ui-card: oklch(0.21 0.006 285.885);
  --ui-muted: oklch(0.274 0.006 286.033);
  --ui-border: oklch(1 0 0 / 10%);
  --background: var(--ui-background);
  --foreground: var(--ui-foreground);
  --card: var(--ui-card);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --accent: var(--ui-muted);
  --accent-foreground: var(--ui-foreground);
}

.landing-topbar {
  width: 100%;
  min-height: 112px;
  display: grid;
  grid-template-columns: 230px minmax(420px, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: start;
  gap: 24px;
  row-gap: 12px;
  margin: 0;
  border: 1px solid var(--topbar-border);
  border-top: 0;
  background: var(--topbar-surface);
  padding: 16px 22px 14px;
  box-sizing: border-box;
}

.landing-topbar-brand {
  min-width: 0;
  display: flex;
  flex-direction: column;
  grid-row: 1 / span 2;
  align-items: flex-start;
}

.landing-topbar-logo {
  width: 96px;
  height: 34px;
  object-fit: contain;
  object-position: left center;
}

.landing-topbar-logo-dark {
  display: none;
}

.landing-topbar-story[data-theme="dark"] .landing-topbar-logo-light {
  display: none;
}

.landing-topbar-story[data-theme="dark"] .landing-topbar-logo-dark {
  display: block;
}

.landing-topbar-phone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: var(--topbar-ink);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
}

.landing-topbar-phone svg {
  color: #22c55e;
}

.landing-topbar-status {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  color: var(--topbar-muted);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
}

.landing-topbar-status span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #22c55e;
}

.landing-topbar-chat {
  min-width: 0;
}

.landing-topbar-form {
  min-height: 42px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--topbar-border);
  border-radius: 10px;
  background: var(--topbar-field);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  padding: 4px 4px 4px 14px;
  box-sizing: border-box;
}

.landing-topbar .landing-topbar-input {
  min-width: 0;
  min-height: 20px;
  height: 20px;
  resize: none;
  border: 0 !important;
  outline: 0;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--topbar-ink);
  font-size: 14px;
  line-height: 20px;
  padding: 0;
}

.landing-topbar .landing-topbar-input::placeholder {
  color: var(--topbar-muted);
}

.landing-topbar-attach,
.landing-topbar-send {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--topbar-muted);
  padding: 0;
}

.landing-topbar-send {
  width: 32px;
  height: 32px;
  background: var(--topbar-send);
  color: #fff;
}

.landing-topbar-story[data-theme="dark"] .landing-topbar-send {
  color: var(--topbar-ink);
}

.landing-topbar-attach:hover,
.landing-topbar .landing-topbar-icon-control:hover {
  background: var(--topbar-control-hover);
  color: var(--topbar-ink);
}

.landing-topbar-phrases {
  grid-column: 2 / -1;
  grid-row: 2;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  height: 28px;
  overflow: hidden;
  align-content: flex-start;
}

.landing-topbar-phrase {
  flex: 0 0 auto;
  height: 26px;
  min-height: 26px;
  gap: 7px;
  border: 1px solid var(--topbar-border);
  border-radius: 999px;
  background: var(--topbar-chip);
  color: var(--topbar-ink);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.landing-topbar-phrase svg {
  color: currentColor;
  stroke-width: 2;
}

.landing-topbar-phrase:hover {
  background: var(--topbar-control-hover);
}

.landing-topbar-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 4px;
}

.landing-topbar .landing-topbar-icon-control {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--topbar-muted);
  box-shadow: none;
  padding: 0;
}

.landing-topbar-login {
  height: 38px;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: var(--topbar-login);
  color: var(--topbar-surface);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
}

.landing-topbar-story[data-theme="dark"] .landing-topbar-login {
  color: #111113;
}

@media (max-width: 960px) {
  .landing-topbar {
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto;
    align-items: center;
    gap: 10px;
    row-gap: 10px;
    padding: 12px 14px 10px;
  }

  .landing-topbar-brand {
    grid-column: 1;
    grid-row: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 12px;
    row-gap: 2px;
    align-items: center;
  }

  .landing-topbar-logo {
    grid-row: 1 / span 2;
    width: 84px;
    height: 30px;
  }

  .landing-topbar-phone {
    margin-top: 0;
    font-size: 12px;
  }

  .landing-topbar-status {
    margin-top: 0;
    font-size: 9px;
  }

  .landing-topbar-chat {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .landing-topbar-form {
    min-height: 38px;
    border-radius: 9px;
    padding-left: 12px;
  }

  .landing-topbar-controls {
    grid-column: 2;
    grid-row: 1;
    gap: 8px;
    justify-self: end;
    padding-top: 0;
  }

  .landing-topbar .landing-topbar-icon-control {
    width: 34px;
    height: 34px;
    border: 1px solid var(--topbar-border);
    border-radius: 9px;
    background: transparent;
  }

  .landing-topbar-login {
    width: 38px;
    height: 34px;
    border-radius: 9px;
    padding: 0;
    font-size: 0;
    gap: 0;
  }

  .landing-topbar-login svg {
    margin: 0;
  }

  .landing-topbar-phrases {
    grid-column: 1 / -1;
    grid-row: 3;
    flex-wrap: nowrap;
    gap: 7px;
    height: 28px;
    margin-inline: -14px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 14px;
    scroll-padding-inline: 14px;
    scrollbar-width: none;
  }

  .landing-topbar-phrases::-webkit-scrollbar {
    display: none;
  }

  .landing-topbar-phrase {
    height: 27px;
    min-height: 27px;
    padding: 0 11px;
    font-size: 12px;
  }
}

@media (max-width: 520px) {
  .landing-topbar {
    gap: 9px;
    row-gap: 9px;
    padding: 10px 12px 9px;
  }

  .landing-topbar-brand {
    column-gap: 9px;
  }

  .landing-topbar-logo {
    width: 60px;
    height: 25px;
  }

  .landing-topbar-phone {
    font-size: 11px;
  }

  .landing-topbar-status {
    font-size: 8px;
  }

  .landing-topbar .landing-topbar-icon-control {
    width: 32px;
    height: 32px;
  }

  .landing-topbar-login {
    width: 34px;
    height: 32px;
  }

  .landing-topbar-controls {
    gap: 6px;
  }

  .landing-topbar-phrases {
    margin-inline: -12px;
    padding-inline: 12px;
    scroll-padding-inline: 12px;
  }
}
`;

const meta = {
  title: "Prototypes/LandingTopBar",
  component: LandingTopBarStory,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LandingTopBarStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: "light" },
  globals: { theme: "light" },
};

export const Dark: Story = {
  args: { theme: "dark" },
  globals: { theme: "dark" },
};
