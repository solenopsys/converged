import { useState, type ReactNode } from "react";
import {
	Globe2,
	LogIn,
	Moon,
	PanelLeftOpen,
	Paperclip,
	Send,
	Sun,
} from "lucide-react";
import { Button, Textarea } from "../ui";
import { PhoneContact } from "../phone-contact/PhoneContact";
import "./LandingTopBar.css";

const CONTROL_ICON_SIZE = 17;
const COMPOSER_ICON_SIZE = 15;

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
	onCall?: () => void;
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
	onCall,
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
	]
		.filter(Boolean)
		.join(" ");

	return (
		<header className={headerClass} aria-label="Top bar">
			<div className="ltb-brand">
				{logoLight && (
					<img
						className="ltb-logo ltb-logo--light"
						src={logoLight}
						alt=""
						aria-hidden="true"
					/>
				)}
				{logoDark && (
					<img
						className="ltb-logo ltb-logo--dark"
						src={logoDark}
						alt=""
						aria-hidden="true"
					/>
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
						<PanelLeftOpen size={CONTROL_ICON_SIZE} />
					</Button>
				)}
				<PhoneContact
					className="ltb-phone-contact"
					phone={phone}
					onCall={onCall ? () => onCall() : undefined}
				/>
				{statusText && (
					<div className="ltb-status">
						<span aria-hidden="true" />
						{statusText}
					</div>
				)}
			</div>

			{!compact && (
				<div className="ltb-chat">
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
							<Paperclip size={COMPOSER_ICON_SIZE} />
						</Button>
						<Button
							className="ltb-send"
							size="icon"
							type="submit"
							aria-label="Send"
						>
							<Send size={COMPOSER_ICON_SIZE} />
						</Button>
					</form>
				</div>
			)}

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
						{isDark ? (
							<Sun size={CONTROL_ICON_SIZE} />
						) : (
							<Moon size={CONTROL_ICON_SIZE} />
						)}
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
							<Globe2 size={CONTROL_ICON_SIZE} />
							<span className="ltb-lang-label">
								{languages.find((l) => l.code === currentLanguage)?.label ??
									currentLanguage?.toUpperCase()}
							</span>
						</Button>
						<div className="ltb-lang-popover" role="menu">
							{languages.map((lang) => (
								<button
									key={lang.code}
									className={`ltb-lang-option${
										currentLanguage === lang.code ? " is-active" : ""
									}`}
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
						<LogIn size={CONTROL_ICON_SIZE} />
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
	);
}
