import { Globe2, LogIn, Moon, PanelLeftClose, Sun } from "lucide-react";
import { useState } from "react";
import { useUnit } from "effector-react";
import { Button } from "../ui";
import { $lang, $theme, langChanged, themeToggled } from "./converged-rail-model";

export interface LangOption {
	code: string;
	label: string;
}

export interface ConvergedRailControlsProps {
	languages?: LangOption[];
	onCollapse?: () => void;
}

export function ConvergedRailControls({
	languages = [],
	onCollapse,
}: ConvergedRailControlsProps) {
	const theme = useUnit($theme);
	const lang = useUnit($lang);
	const toggle = useUnit(themeToggled);
	const setLang = useUnit(langChanged);
	const [langOpen, setLangOpen] = useState(false);

	return (
		<div className="crc">
			<style>{css}</style>
			<Button className="ssr-panel-control" size="icon" variant="ghost" type="button" aria-label="Login">
				<LogIn size={17} />
			</Button>
			<Button
				className="ssr-panel-control"
				size="icon"
				variant="ghost"
				type="button"
				aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
				onClick={() => toggle()}
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
								onClick={() => { setLang(item.code); setLangOpen(false); }}
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

const css = `
.crc {
  display: flex;
  align-items: center;
  gap: 4px;
}

.crc .ssr-panel-control {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in oklch, currentColor 22%, transparent);
  border-radius: 10px;
  background: transparent;
  color: color-mix(in oklch, currentColor 82%, transparent);
  cursor: pointer;
}

.crc .ssr-panel-control:hover {
  background: color-mix(in oklch, var(--ui-muted) 88%, transparent);
}

.crc .ssr-panel-control svg {
  width: 17px;
  height: 17px;
  display: block;
}

.crc .ssr-lang-trigger {
  width: auto;
  min-width: 30px;
  padding: 0 8px;
  gap: 6px;
}

.crc .ssr-lang-current {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.crc-lang {
  position: relative;
}

.crc-lang-popover {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 96px;
  padding: 6px;
  gap: 4px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 88%, transparent);
  border-radius: 10px;
  background: var(--ui-card);
  box-shadow: 0 12px 30px rgba(2, 6, 23, 0.25);
}

.crc-lang[data-open="1"] .crc-lang-popover {
  display: grid;
}

.crc-lang-option {
  width: 100%;
  min-height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.crc-lang-option:hover,
.crc-lang-option[aria-checked="true"] {
  background: var(--ui-accent);
}
`;
