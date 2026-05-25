import { Paperclip, Send, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Textarea } from "../ui";

export interface RailScreen {
	id: string;
	label: string;
	detail?: string;
	icon: ReactNode;
}

export interface RailQuickAction {
	id: string;
	label: string;
	prompt: string;
	icon: ReactNode;
}

export interface ConvergedRailPanelProps {
	logoLight?: string;
	logoDark?: string;
	screens?: RailScreen[];
	activeScreenId?: string;
	onScreenChange?: (id: string) => void;
	onScreenClose?: (id: string) => void;
	menuSlot?: ReactNode;
	quickActions?: RailQuickAction[];
	onQuickAction?: (prompt: string) => void;
	chatSlot?: ReactNode;
	composerValue?: string;
	onComposerChange?: (value: string) => void;
	onComposerSubmit?: () => void;
	onComposerAttach?: () => void;
	composerPlaceholder?: string;
	controls?: ReactNode;
}

export function ConvergedRailPanel({
	logoLight,
	logoDark,
	screens = [],
	activeScreenId,
	onScreenChange,
	onScreenClose,
	menuSlot,
	quickActions = [],
	onQuickAction,
	chatSlot,
	composerValue = "",
	onComposerChange,
	onComposerSubmit,
	onComposerAttach,
	composerPlaceholder = "Ask anything...",
	controls,
}: ConvergedRailPanelProps) {
	return (
		<>
			<style>{css}</style>
			<section className="crp" aria-label="Converged panel">
				<header className="ssr-panel-head crp-head">
					<div className="crp-brand">
						{logoLight && (
							<img
								className="crp-logo crp-logo--light"
								src={logoLight}
								alt=""
								aria-hidden="true"
							/>
						)}
						{logoDark && (
							<img
								className="crp-logo crp-logo--dark"
								src={logoDark}
								alt=""
								aria-hidden="true"
							/>
						)}
					</div>
					{controls && <div className="crp-controls">{controls}</div>}
				</header>

				<div className="crp-menu">
					{menuSlot}

					{screens.length > 0 && (
						<section className="crp-screens" aria-label="Open screens">
							<h2 className="crp-section-title">Open screens</h2>
							<div className="crp-screen-list">
								{screens.map((screen) => (
									<div
										key={screen.id}
										className="crp-screen"
										data-active={screen.id === activeScreenId ? "1" : "0"}
									>
										<Button
											className="crp-screen-btn"
											onClick={() => onScreenChange?.(screen.id)}
											type="button"
											variant="ghost"
										>
											<span className="crp-screen-icon">{screen.icon}</span>
											<span className="crp-screen-label">{screen.label}</span>
											{screen.detail && (
												<span className="crp-screen-detail">
													{screen.detail}
												</span>
											)}
										</Button>
										<button
											className="crp-screen-close"
											aria-label={`Close ${screen.label}`}
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onScreenClose?.(screen.id);
											}}
										>
											<X size={14} />
										</button>
									</div>
								))}
							</div>
						</section>
					)}

					{quickActions.length > 0 && (
						<div className="crp-quick-actions">
							{quickActions.map((action) => (
								<Button
									key={action.id}
									className="crp-quick-action"
									onClick={() => onQuickAction?.(action.prompt)}
									type="button"
									variant="ghost"
								>
									{action.icon}
									{action.label}
								</Button>
							))}
						</div>
					)}
				</div>

				<div className="crp-chat">{chatSlot}</div>

				<footer className="crp-composer">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							onComposerSubmit?.();
						}}
					>
						<Button
							aria-label="Attach file"
							className="crp-composer-action"
							onClick={() => onComposerAttach?.()}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Paperclip size={15} />
						</Button>
						<Textarea
							className="crp-composer-input"
							aria-label="AI chat input"
							placeholder={composerPlaceholder}
							rows={1}
							value={composerValue}
							onChange={(e) => onComposerChange?.(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									onComposerSubmit?.();
								}
							}}
						/>
						<Button
							aria-label="Send message"
							className="crp-composer-send"
							size="icon"
							type="submit"
							variant="ghost"
						>
							<Send size={15} />
						</Button>
					</form>
				</footer>
			</section>
		</>
	);
}

const css = `
.crp {
  --crp-radius: 10px;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 54px auto minmax(0, 1fr) 64px;
  overflow: hidden;
  background: var(--ui-card);
  color: var(--ui-foreground);
}

.crp-head {
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 10px 14px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
}

.crp-brand { display: flex; align-items: center; }

.crp-logo {
  width: 96px;
  height: 34px;
  object-fit: contain;
  object-position: left center;
}

.crp-logo[src$=".png"] {
  width: 156px;
  height: 34px;
  object-fit: cover;
  object-position: center;
}

.crp-logo--dark { display: none; }
.dark .crp-logo--light, html.dark .crp-logo--light { display: none; }
.dark .crp-logo--dark, html.dark .crp-logo--dark { display: block; }

.crp-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.crp .ssr-panel-control {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.crp .ssr-panel-control svg {
  width: 17px;
  height: 17px;
}

.crp-menu {
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
}

.crp-menu-slot {
  min-height: 0;
  overflow: auto;
}

.crp-menu-slot:empty {
  display: none;
}

.crp-screens { padding: 18px 12px 10px; }

.crp-section-title {
  margin: 0 0 12px;
  padding: 0 8px;
  color: color-mix(in oklch, var(--ui-foreground) 58%, transparent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.crp-screen-list { display: flex; flex-direction: column; gap: 3px; }
.crp-screen { position: relative; }

.crp-screen-btn {
  min-width: 0;
  width: 100%;
  height: 32px;
  justify-content: flex-start;
  gap: 10px;
  border-radius: var(--crp-radius);
  padding: 0 34px 0 8px;
  background: transparent;
  color: var(--ui-foreground);
}

.crp-screen[data-active="1"] .crp-screen-btn {
  background: color-mix(in oklch, var(--ui-muted) 82%, transparent);
}

.crp-screen-icon { width: 17px; height: 17px; display: grid; flex: 0 0 auto; place-items: center; }
.crp-screen-label { min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.crp-screen-detail { flex: 0 1 auto; min-width: 0; overflow: hidden; color: color-mix(in oklch, var(--ui-foreground) 54%, transparent); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }

.crp-screen-close {
  width: 24px; height: 24px;
  position: absolute; top: 4px; right: 4px;
  display: inline-grid; border: 0; background: transparent; padding: 0;
  opacity: 0; place-items: center;
  border-radius: calc(var(--crp-radius) - 3px);
  color: color-mix(in oklch, var(--ui-foreground) 48%, transparent);
  cursor: pointer;
  transition: opacity 120ms ease, background 120ms ease;
}

.crp-screen:hover .crp-screen-close { opacity: 1; }
.crp-screen-close:hover { background: color-mix(in oklch, var(--ui-muted) 68%, transparent); color: var(--ui-foreground); }

.crp-quick-actions { display: flex; flex-direction: column; gap: 6px; padding: 0 12px 12px; }

.crp-quick-action {
  width: 100%;
  min-height: 34px;
  justify-content: flex-start;
  border: 1px solid color-mix(in oklch, var(--ui-border) 46%, transparent);
  border-radius: var(--crp-radius);
  background: color-mix(in oklch, var(--ui-muted) 34%, transparent);
  box-shadow: none;
  color: color-mix(in oklch, var(--ui-foreground) 88%, transparent);
  padding: 7px 11px;
  font-size: 13px;
  font-weight: 600;
}

.crp-quick-action:hover {
  border-color: color-mix(in oklch, var(--ui-foreground) 16%, transparent);
  background: color-mix(in oklch, var(--ui-muted) 68%, transparent);
  color: var(--ui-foreground);
}

.crp-quick-action:focus-visible {
  border-color: color-mix(in oklch, var(--ui-foreground) 24%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--ui-foreground) 10%, transparent);
}

.crp-chat {
  grid-row: 3;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 0;
  overflow: hidden;
  border-top: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
}

.crp-chat > * { flex: 1 1 auto; min-height: 0; }

.crp #slot-panel-chat { min-height: 0; }
.crp #slot-panel-tab { display: none !important; min-height: 0; }

.crp-chat .threaded-chat-root {
  max-width: none;
  margin-inline: 0;
}

.crp-chat .threaded-chat-scroll {
  min-height: 0;
  padding: 12px 10px;
}

.crp-chat .threaded-chat-messages {
  margin-top: 0;
  justify-content: flex-start;
}

.crp-composer {
  grid-row: 4;
  padding: 10px 12px;
  border-top: 1px solid color-mix(in oklch, var(--ui-border) 74%, transparent);
  background: color-mix(in oklch, var(--ui-card) 92%, transparent);
}

.crp-composer form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  padding: 4px 14px;
  background: var(--ui-muted);
}

.crp-composer-action,
.crp-composer-send {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  color: var(--ui-muted-foreground);
}

.crp-composer-action:hover {
  background: var(--ui-accent);
  color: var(--ui-foreground);
}

.crp-composer-send {
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.crp-composer-input {
  flex: 1;
  min-height: 20px;
  height: 20px;
  resize: none;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  padding: 0;
  font-size: 14px;
}
`;
