"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Paperclip, SendHorizontal } from "lucide-react";
import { useHeroDock } from "./useHeroDock";

export interface HeroChip {
  icon?: ReactNode;
  iconName?: string;
  label: string;
  prompt: string;
}

export interface HeroInputDockProps {
  placeholder?: string;
  chips?: HeroChip[];
  attachLabel?: string;
  contextName?: string;
  inputLabel?: string;
  messageInputName?: string;
  submitLabel?: string;
}

// The hero input never talks to the chat runtime directly. It only renders a
// form annotated with `data-landing-event` attributes; the document-level
// gateway in island-client (`installLandingEventGateway`) intercepts the submit
// (and the attach click), prevents the native navigation and opens the chat.
// This is a single behaviour that works both for the SSR-only markup (guest
// landings that are never hydrated) and for the hydrated React tree, so portals
// don't have to wire a "mode" — and can't accidentally fall back to a native
// form submit that reloads the page.
export function HeroInputDock({
  placeholder = "Ask anything...",
  attachLabel = "Attach file",
  chips = [],
  contextName = "request",
  inputLabel = "Request details",
  messageInputName = "hero_request_text",
  submitLabel = "Send",
}: HeroInputDockProps) {
  if (typeof window === "undefined") {
    return (
      <>
        <style>{heroDockCss}</style>
        <HeroInputDockStatic
          attachLabel={attachLabel}
          chips={chips}
          contextName={contextName}
          inputLabel={inputLabel}
          messageInputName={messageInputName}
          placeholder={placeholder}
          submitLabel={submitLabel}
        />
      </>
    );
  }

  const [value, setValue] = useState("");
  const { slotRef, docked } = useHeroDock();

  return (
    <>
      <style>{heroDockCss}</style>

      {/* Extension backdrop behind topbar when docked */}
      {docked && <div className="hsl-topbar-extension" aria-hidden="true" />}

      {/* Slot: its position is measured for docking threshold */}
      <div ref={slotRef} className="hsl-hero-input-slot">
        <div className={docked ? "hsl-hero-input hsl-hero-input--docked" : "hsl-hero-input"}>
          <div className="hsl-input-wrap">
            <form
              className="hsl-form"
              autoComplete="off"
              // The gateway prevents navigation; we also prevent it here so that
              // a missing gateway (e.g. Storybook) can never reload the page.
              onSubmit={(e) => e.preventDefault()}
              data-landing-event="chat.open"
              data-landing-context-name={contextName}
              data-landing-message-input={`[name="${messageInputName}"]`}
            >
              <textarea
                className="hsl-textarea"
                name={messageInputName}
                aria-label={inputLabel}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                rows={1}
                wrap="off"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                className="hsl-attach"
                type="button"
                aria-label={attachLabel}
                data-landing-event="chat.attach"
                data-landing-context-name={contextName}
              >
                <Paperclip size={15} />
              </button>
              <button className="hsl-send" type="submit" aria-label={submitLabel}>
                <SendHorizontal size={15} />
              </button>
            </form>

            {chips.length > 0 && (
              <div className="hsl-chips">
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    className="hsl-chip"
                    type="button"
                    data-hero-icon={chip.iconName}
                    data-hero-prompt={chip.prompt}
                    onClick={() => setValue(chip.prompt)}
                  >
                    {chip.icon}
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function HeroInputDockStatic({
  attachLabel,
  chips,
  contextName,
  inputLabel,
  messageInputName,
  placeholder,
  submitLabel,
}: {
  attachLabel: string;
  chips: HeroChip[];
  contextName: string;
  inputLabel: string;
  messageInputName: string;
  placeholder: string;
  submitLabel: string;
}) {
  return (
    <div className="hsl-hero-input-slot">
      <div className="hsl-hero-input">
        <div className="hsl-input-wrap">
          <form
            className="hsl-form"
            autoComplete="off"
            data-landing-event="chat.open"
            data-landing-context-name={contextName}
            data-landing-message-input={`[name="${messageInputName}"]`}
          >
            <textarea
              className="hsl-textarea"
              name={messageInputName}
              aria-label={inputLabel}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              rows={1}
              wrap="off"
              placeholder={placeholder}
            />
            <button
              className="hsl-attach"
              type="button"
              aria-label={attachLabel}
              data-landing-event="chat.attach"
              data-landing-context-name={contextName}
            >
              <span aria-hidden="true">↥</span>
            </button>
            <button className="hsl-send" type="submit" aria-label={submitLabel}>
              <span aria-hidden="true">➤</span>
            </button>
          </form>

          {chips.length > 0 && (
            <div className="hsl-chips">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  className="hsl-chip"
                  type="button"
                  data-hero-icon={chip.iconName}
                  data-hero-prompt={chip.prompt}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const heroDockCss = `
.hsl-hero-input-slot {
  --hsl-input-width: min(880px, calc(100vw - 40px));
  --hsl-input-lift: clamp(210px, 27vh, 300px);
  position: relative;
  z-index: 1300;
  width: var(--hsl-input-width);
  margin: calc(-1 * var(--hsl-input-lift)) auto calc(var(--hsl-input-lift) - 80px);
  min-height: 96px;
}

.hsl-hero-input {
  --hsl-input-ink: #f8fafc;
  --hsl-input-muted: rgba(248,250,252,0.68);
  --hsl-input-border: rgba(248,250,252,0.24);
  --hsl-input-surface: rgba(248,250,252,0.13);
  --hsl-input-surface-hover: rgba(248,250,252,0.2);
  --hsl-input-action-bg: #f8fafc;
  --hsl-input-action-ink: #07101a;
  width: 100%;
  opacity: 1;
  transition: filter 220ms ease, opacity 220ms ease;
}

.hsl-hero-input--docked {
  position: fixed;
  top: var(--hsl-topbar-height, 52px);
  left: max(20px, calc((100vw - 880px) / 2));
  right: max(20px, calc((100vw - 880px) / 2));
  z-index: 1300;
  width: auto;
  --hsl-input-ink: var(--ui-foreground);
  --hsl-input-muted: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
  --hsl-input-border: color-mix(in oklch, var(--ui-foreground) 18%, transparent);
  --hsl-input-surface: color-mix(in oklch, var(--ui-foreground) 6%, transparent);
  --hsl-input-surface-hover: color-mix(in oklch, var(--ui-foreground) 11%, transparent);
  --hsl-input-action-bg: var(--ui-foreground);
  --hsl-input-action-ink: var(--ui-background);
  filter: none;
}

.hsl-topbar-extension {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--hsl-topbar-docked-height, 164px);
  z-index: 999;
  pointer-events: none;
  background: var(--ui-card);
  background: color-mix(in oklch, var(--ui-card) 88%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid color-mix(in oklch, var(--ui-foreground) 12%, transparent);
  box-shadow: 0 18px 42px rgba(0,0,0,0.18);
}

/* The compact bar stays transparent while its fixed root carries the docked backdrop. */
html[data-hero-input-docked="1"] .ltb--compact {
  background: transparent !important;
  border-bottom-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html[data-hero-input-docked="1"] #ssr-control-panel-root {
  height: var(--hsl-topbar-docked-height, 164px) !important;
  background: var(--ui-card) !important;
  background: color-mix(in oklch, var(--ui-card) 88%, transparent) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-foreground) 12%, transparent) !important;
  box-shadow: 0 18px 42px rgba(0,0,0,0.18) !important;
  transition:
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    height 320ms cubic-bezier(0.16, 1, 0.3, 1) !important;
}

html[data-hero-input-docked="1"] #ssr-control-panel-root .ltb,
html[data-hero-input-docked="1"] #ssr-control-panel-root .ltb--compact {
  background: transparent !important;
  border-bottom-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.hsl-input-wrap {
  display: grid;
  gap: 16px;
}

.hsl-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 4px;
  height: 48px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  border: 1px solid var(--hsl-input-border);
  border-radius: 12px;
  background: var(--hsl-input-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 6px;
  box-sizing: border-box;
}

.hsl-textarea {
  resize: none;
  border: 0;
  background: transparent;
  color: var(--hsl-input-ink);
  font-size: 15px;
  line-height: 1.4;
  outline: none;
  overflow: hidden;
  padding: 6px 10px;
  font-family: inherit;
  white-space: nowrap;
}

.hsl-textarea::placeholder { color: var(--hsl-input-muted); }

.hsl-attach,
.hsl-send {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.hsl-attach {
  background: transparent;
  color: var(--hsl-input-muted);
}

.hsl-send {
  background: var(--hsl-input-action-bg);
  color: var(--hsl-input-action-ink);
}

.hsl-attach:hover {
  background: var(--hsl-input-surface-hover);
  color: var(--hsl-input-ink);
}

.hsl-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  justify-content: center;
  overflow: visible;
}

.hsl-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--hsl-input-border);
  border-radius: 999px;
  background: var(--hsl-input-surface);
  backdrop-filter: blur(8px);
  color: var(--hsl-input-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.hsl-chip:hover {
  background: var(--hsl-input-surface-hover);
  border-color: color-mix(in oklch, var(--hsl-input-ink) 34%, transparent);
}

@media (max-width: 960px) {
  .hsl-hero-input-slot {
    --hsl-input-width: calc(100vw - 28px);
    --hsl-input-lift: clamp(200px, 26vh, 250px);
  }
  .hsl-hero-input--docked {
    left: 14px;
    right: 14px;
  }
  .hsl-chips {
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .hsl-chips::-webkit-scrollbar { display: none; }
}
`;
