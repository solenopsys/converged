import { Globe2, LogIn, LogOut, Moon, PanelLeftClose, Sun } from "lucide-react";
import { useState } from "react";
import type { LangOption, Theme } from "../../landing-common/control-panel-model";
import { Button } from "../ui";
import "./ConvergedRailControls.css";

export interface ConvergedRailControlsProps {
	theme: Theme;
	onThemeToggle: () => void;
	languages?: LangOption[];
	currentLanguage?: string;
	onLanguageChange?: (code: string) => void;
	loginEnabled?: boolean;
	isAuthenticated?: boolean;
	onLogin?: () => void;
	onLogout?: () => void;
	onCollapse?: () => void;
}

export function ConvergedRailControls({
	theme,
	onThemeToggle,
	languages = [],
	currentLanguage,
	onLanguageChange,
	loginEnabled = false,
	isAuthenticated = false,
	onLogin,
	onLogout,
	onCollapse,
}: ConvergedRailControlsProps) {
	const [langOpen, setLangOpen] = useState(false);
	const lang = currentLanguage ?? languages[0]?.code ?? "";

	return (
		<div className="crc">
			{loginEnabled && (
				<Button
					className="ssr-panel-control"
					size="icon"
					variant="ghost"
					type="button"
					aria-label={isAuthenticated ? "Log out" : "Log in"}
					onClick={isAuthenticated ? onLogout : onLogin}
				>
					{isAuthenticated ? <LogOut size={17} /> : <LogIn size={17} />}
				</Button>
			)}
			<Button
				className="ssr-panel-control"
				size="icon"
				variant="ghost"
				type="button"
				aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
				onClick={onThemeToggle}
			>
				{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
			</Button>
			{languages.length > 0 && (
				<div className="crc-lang" data-open={langOpen ? "1" : "0"}>
					<Button
						aria-expanded={langOpen}
						aria-label="Language"
						className="ssr-panel-control ssr-lang-trigger"
						onClick={() => setLangOpen((v) => !v)}
						size="sm"
						variant="ghost"
						type="button"
					>
						<Globe2 size={16} />
						<span className="ssr-lang-current">{lang.toUpperCase()}</span>
					</Button>
					<div className="crc-lang-popover" role="menu" aria-label="Language options">
						{languages.map((item) => (
							<button
								key={item.code}
								className="crc-lang-option"
								type="button"
								role="menuitemradio"
								aria-checked={item.code === lang ? "true" : "false"}
								onClick={() => {
									onLanguageChange?.(item.code);
									setLangOpen(false);
								}}
							>
								{item.label}
							</button>
						))}
					</div>
				</div>
			)}
			{onCollapse && (
				<Button
					className="ssr-panel-control"
					size="icon"
					variant="ghost"
					type="button"
					aria-label="Collapse panel"
					onClick={onCollapse}
				>
					<PanelLeftClose size={17} />
				</Button>
			)}
		</div>
	);
}
