import { useState, type ReactNode } from "react";
import { Globe2, LogIn, Moon, PanelLeftOpen, Paperclip, Send, Sun } from "lucide-react";
import { Button, Textarea } from "../ui";

export interface LandingTopBarAction {
  icon: ReactNode;
  label: string;
  prompt: string;
}

export interface LandingTopBarMenuLink {
  label: string;
  href: string;
}

export interface LandingTopBarProps {
  logoLight?: string;
  logoDark?: string;
  phone?: string;
  statusText?: string;
  actions?: LandingTopBarAction[];
  menuLinks?: LandingTopBarMenuLink[];
  languages?: Array<{ code: string; label: string }>;
  currentLanguage?: string;
  onLogin?: () => void;
  onPanelOpen?: () => void;
  onThemeToggle?: () => void;
  isDark?: boolean;
  onLanguage?: (code: string) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onAttach?: () => void;
  compact?: boolean;
}

export function LandingTopBar({
  logoLight,
  logoDark,
  phone,
  statusText,
  actions = [],
  menuLinks = [],
  languages,
  currentLanguage,
  onLogin,
  onPanelOpen,
  onThemeToggle,
  isDark,
  onLanguage,
  value: valueProp,
  onValueChange,
  onSubmit,
  onAttach,
  compact = false,
}: LandingTopBarProps) {
  const [localValue, setLocalValue] = useState("");
  const [langOpen, setLangOpen] = useState(false);

  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : localValue;
  const setValue = (v: string) => {
    if (!isControlled) setLocalValue(v);
    onValueChange?.(v);
  };

  const handleSubmit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit?.(text);
    if (!isControlled) setLocalValue("");
  };

  const hasMenu = menuLinks.length > 0;
  const headerClass = [
    "ltb",
    compact && "ltb--compact",
    hasMenu && "ltb--has-menu",
  ].filter(Boolean).join(" ");

  return (
    <>
      <style>{landingTopBarCss}</style>
      <header className={headerClass} aria-label="Top bar">
        <div className="ltb-brand">
          {logoLight && (
            <img className="ltb-logo ltb-logo--light" src={logoLight} alt="" aria-hidden="true" />
          )}
          {logoDark && (
            <img className="ltb-logo ltb-logo--dark" src={logoDark} alt="" aria-hidden="true" />
          )}
          {onPanelOpen && (
            <Button
              className="ltb-panel-open"
              size="icon"
              type="button"
              variant="ghost"
              aria-label="Open control panel"
              onClick={onPanelOpen}
            >
              <PanelLeftOpen size={15} />
            </Button>
          )}
          {phone && (
            <a className="ltb-phone" href={`tel:${phone.replace(/\s/g, "")}`}>
              <span className="ltb-phone-dot" aria-hidden="true" />
              {phone}
            </a>
          )}
          {statusText && (
            <div className="ltb-status">
              <span aria-hidden="true" />
              {statusText}
            </div>
          )}
        </div>

        {!compact && <div className="ltb-chat">
          <form
            className="ltb-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <Textarea
              aria-label="Ask AI"
              className="ltb-input"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="ask anything..."
              rows={1}
              value={value}
            />
            <Button
              className="ltb-attach"
              size="icon"
              type="button"
              variant="ghost"
              aria-label="Attach file"
              onClick={() => onAttach?.()}
            >
              <Paperclip size={15} />
            </Button>
            <Button className="ltb-send" size="icon" type="submit" aria-label="Send">
              <Send size={15} />
            </Button>
          </form>
        </div>}

        {compact && menuLinks.length > 0 && (
          <nav className="ltb-menu" aria-label="Main menu">
            {menuLinks.map((link) => (
              <a key={link.label} className="ltb-menu-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="ltb-controls">
          {onThemeToggle && (
            <Button
              className="ltb-icon-btn"
              size="icon"
              type="button"
              variant="ghost"
              aria-label="Toggle theme"
              onClick={onThemeToggle}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </Button>
          )}
          {languages && languages.length > 0 && (
            <div className="ltb-lang" data-open={langOpen ? "1" : "0"}>
              <Button
                aria-expanded={langOpen}
                aria-label="Language"
                className="ltb-icon-btn ltb-lang-btn"
                onClick={() => setLangOpen((v) => !v)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Globe2 size={15} />
                <span className="ltb-lang-label">
                  {languages.find((l) => l.code === currentLanguage)?.label ?? currentLanguage?.toUpperCase()}
                </span>
              </Button>
              <div className="ltb-lang-popover" role="menu">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`ltb-lang-option${currentLanguage === lang.code ? " is-active" : ""}`}
                    type="button"
                    onClick={() => {
                      onLanguage?.(lang.code);
                      setLangOpen(false);
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {onLogin && (
            <Button className="ltb-login" type="button" onClick={onLogin}>
              <LogIn size={14} />
              log in
            </Button>
          )}
        </div>

        {!compact && actions.length > 0 && (
          <div className="ltb-actions" aria-label="Quick actions">
            {actions.map((action) => (
              <Button
                className="ltb-action"
                key={action.label}
                onClick={() => setValue(action.prompt)}
                type="button"
                variant="outline"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </header>
    </>
  );
}

export const landingTopBarCss = `
.ltb {
  width: 100%;
  min-height: 112px;
  display: grid;
  grid-template-columns: 230px minmax(420px, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: start;
  gap: 24px;
  row-gap: 12px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 60%, transparent);
  background: color-mix(in oklch, var(--ui-card) 88%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 1px 0 color-mix(in oklch, var(--ui-border) 40%, transparent),
              0 4px 24px color-mix(in oklch, oklch(0% 0 0) 18%, transparent);
  padding: 16px 22px 14px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.ltb-brand {
  min-width: 0;
  display: flex;
  flex-direction: column;
  grid-row: 1 / span 2;
  align-items: flex-start;
}

.ltb-logo {
  width: 96px;
  height: 34px;
  object-fit: contain;
  object-position: left center;
}

.ltb-logo[src$=".png"] {
  width: 132px;
  height: 34px;
  object-fit: cover;
  object-position: center;
}

.ltb-logo--dark { display: none; }
.dark .ltb-logo--light, html.dark .ltb-logo--light { display: none; }
.dark .ltb-logo--dark,  html.dark .ltb-logo--dark  { display: block; }

.ltb-panel-open {
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 72%, transparent);
  border-radius: 10px;
  background: color-mix(in oklch, var(--ui-card) 74%, transparent);
  color: var(--ui-muted-foreground);
  flex-shrink: 0;
}

.ltb-panel-open:hover {
  background: var(--ui-accent);
  color: var(--ui-foreground);
}

.ltb-phone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: var(--ui-foreground);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
}

.ltb-phone-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-chart-2);
  flex-shrink: 0;
}

.ltb-status {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  color: var(--ui-muted-foreground);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
}

.ltb-status span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-chart-2);
}

.ltb-chat {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.ltb-form {
  min-height: 42px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px 32px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-muted);
  padding: 4px 4px 4px 14px;
  box-sizing: border-box;
}

.ltb .ltb-input {
  min-width: 0;
  min-height: 20px;
  height: 20px;
  resize: none;
  border: 0 !important;
  outline: 0;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--ui-foreground);
  font-size: 14px;
  line-height: 20px;
  padding: 0;
}

.ltb .ltb-input::placeholder { color: var(--ui-muted-foreground); }

.ltb-attach, .ltb-send {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ui-muted-foreground);
  padding: 0;
  flex-shrink: 0;
}

.ltb-send {
  width: 32px;
  height: 32px;
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.ltb-attach:hover { background: var(--ui-accent); color: var(--ui-foreground); }

/* Compact mode — only brand + controls, slim height */
.ltb--compact {
  min-height: 52px;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto;
  gap: 0;
  align-items: center;
  padding: 8px 22px;
}

.ltb--compact .ltb-brand {
  grid-row: 1;
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.ltb--compact .ltb-logo {
  width: 72px;
  height: 26px;
}

.ltb--compact .ltb-logo[src$=".png"] {
  width: 132px;
  height: 34px;
}

.ltb--compact .ltb-phone,
.ltb--compact .ltb-status {
  display: none;
}

.ltb--compact .ltb-controls {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  padding-top: 0;
}

/* When menu links are present (compact mode), make outer columns symmetric
   so the menu is exactly centered in the viewport — not in the leftover space
   between brand and controls (which are different widths). */
.ltb--compact.ltb--has-menu {
  grid-template-columns: 1fr auto 1fr;
}

.ltb-menu {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  min-width: 0;
}

.ltb-menu-link {
  color: var(--ui-muted-foreground);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 150ms ease;
}

.ltb-menu-link:hover {
  color: var(--ui-foreground);
}

.ltb-actions {
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

.ltb-action {
  flex: 0 0 auto;
  height: 26px;
  min-height: 26px;
  gap: 7px;
  border-radius: 999px;
  background: var(--ui-background);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.ltb-controls {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding-top: 4px;
}

.ltb-icon-btn {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--ui-muted-foreground);
  box-shadow: none;
  padding: 0;
}

.ltb-lang-btn {
  width: auto;
  min-width: 46px;
  gap: 5px;
  padding: 0 8px;
}

.ltb-lang-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.ltb-login {
  height: 38px;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-foreground);
  color: var(--ui-background);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
}

.ltb-lang { position: relative; }

.ltb-lang-popover {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--ui-card);
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  padding: 4px;
  z-index: 100;
  box-shadow: 0 4px 12px oklch(0% 0 0 / 15%);
}

.ltb-lang[data-open="1"] .ltb-lang-popover { display: flex; flex-direction: column; gap: 2px; }

.ltb-lang-option {
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-muted-foreground);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.ltb-lang-option:hover, .ltb-lang-option.is-active {
  background: var(--ui-accent);
  color: var(--ui-foreground);
}

@media (max-width: 960px) {
  .ltb {
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto;
    align-items: center;
    gap: 10px;
    row-gap: 10px;
    padding: 12px 14px 10px;
  }

  .ltb-brand {
    grid-column: 1; grid-row: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 12px;
    row-gap: 2px;
    align-items: center;
  }

  .ltb-logo { grid-row: 1 / span 2; width: 84px; height: 30px; }
  .ltb-logo[src$=".png"] { width: 112px; height: 30px; }
  .ltb-phone { margin-top: 0; font-size: 12px; }
  .ltb-status { margin-top: 0; font-size: 9px; }
  .ltb-chat { grid-column: 1 / -1; grid-row: 2; }
  .ltb-controls { grid-column: 2; grid-row: 1; gap: 8px; justify-self: end; padding-top: 0; }

  .ltb-login {
    width: 38px; height: 34px;
    border-radius: 9px; padding: 0;
    font-size: 0; gap: 0;
  }

  .ltb-actions {
    grid-column: 1 / -1; grid-row: 3;
    flex-wrap: nowrap; gap: 7px; height: 28px;
    margin-inline: -14px;
    overflow-x: auto; overflow-y: hidden;
    padding: 0 14px;
    scrollbar-width: none;
  }

  .ltb-actions::-webkit-scrollbar { display: none; }

  .ltb--compact {
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto;
  }

  .ltb--compact .ltb-controls {
    grid-column: 3;
    grid-row: 1;
  }

  .ltb-menu { display: none; }
}
`;
