"use client";
import "./HeroInputDock.css";

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

