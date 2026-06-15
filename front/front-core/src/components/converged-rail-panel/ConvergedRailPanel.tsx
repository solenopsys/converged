import { Paperclip, Send, X } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
import {
	CHAT_TAB_ID,
	type PanelAction,
	type PanelTab,
	type RailScreen,
} from "../../landing-common/control-panel-model";
import { PhoneContact } from "../phone-contact/PhoneContact";
import { Button, Textarea } from "../ui";
import "./ConvergedRailPanel.css";

export type { PanelAction, PanelTab, RailScreen };

export interface ConvergedRailPanelProps {
	logoLight?: string;
	logoDark?: string;
	phone?: string;
	onCall?: (phone: string) => void;
	screens?: RailScreen[];
	activeScreenId?: string;
	onScreenChange?: (id: string) => void;
	onScreenClose?: (id: string) => void;
	shortcuts?: Array<{ label: string; href: string }>;
	onShortcutClick?: (href: string) => void;
	chatSlot?: ReactNode;
	composerValue?: string;
	onComposerChange?: (value: string) => void;
	onComposerSubmit?: () => void;
	onComposerAttach?: () => void;
	composerPlaceholder?: string;
	controls?: ReactNode;
	tabs?: PanelTab[];
	activeTabId?: string;
	onTabChange?: (id: string) => void;
	tabContent?: ReactNode;
	onResizePointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
	resizing?: boolean;
}

export function ConvergedRailPanel({
	logoLight,
	logoDark,
	phone,
	onCall,
	screens = [],
	activeScreenId,
	onScreenChange,
	onScreenClose,
	shortcuts = [],
	onShortcutClick,
	chatSlot,
	composerValue = "",
	onComposerChange,
	onComposerSubmit,
	onComposerAttach,
	composerPlaceholder = "Ask anything...",
	controls,
	tabs = [],
	activeTabId = CHAT_TAB_ID,
	onTabChange,
	tabContent,
	onResizePointerDown,
	resizing = false,
}: ConvergedRailPanelProps) {
	const showTabStrip = tabs.length > 1;
	const isChatActive = activeTabId === CHAT_TAB_ID;
	const hasTabContent = !isChatActive && tabContent != null;
	const showScreens = shortcuts.length === 0 && screens.length > 0;

	return (
		<section
			className="crp"
			aria-label="Converged panel"
			data-tab-active={hasTabContent ? "1" : "0"}
			data-resizing={resizing ? "1" : "0"}
		>
			{onResizePointerDown && (
				<button
					type="button"
					className="crp-resizer"
					aria-label="Resize side panel"
					onPointerDown={onResizePointerDown}
				/>
			)}
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
				{(controls || phone) && (
					<div className="crp-control-stack">
						{controls && <div className="crp-controls">{controls}</div>}
						<PhoneContact
							className="crp-phone-contact"
							phone={phone}
							onCall={onCall}
							variant="rail"
						/>
					</div>
				)}
			</header>

			{showTabStrip && (
				<nav className="crp-tabs" aria-label="Panel tabs">
					{tabs.map((tab) => {
						const isActive = tab.id === activeTabId;
						return (
							<Button
								key={tab.id}
								className="crp-tab"
								type="button"
								variant="ghost"
								size="icon"
								aria-label={tab.label}
								aria-pressed={isActive}
								title={tab.label}
								onClick={() => onTabChange?.(tab.id)}
							>
								{tab.icon}
							</Button>
						);
					})}
				</nav>
			)}

			{hasTabContent ? (
				<div className="crp-tab-content">{tabContent}</div>
			) : (
				<>
					<div className="crp-menu">
						{shortcuts.length > 0 && (
							<section className="crp-shortcuts" aria-label="Landing shortcuts">
								<div className="crp-shortcut-list">
									{shortcuts.map((shortcut) => (
										<Button
											key={`${shortcut.label}:${shortcut.href}`}
											className="crp-shortcut"
											onClick={() => onShortcutClick?.(shortcut.href)}
											type="button"
											variant="ghost"
										>
											{shortcut.label}
										</Button>
									))}
								</div>
							</section>
						)}

						{showScreens && (
							<section className="crp-screens" aria-label="Screens">
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
				</>
			)}
		</section>
	);
}
