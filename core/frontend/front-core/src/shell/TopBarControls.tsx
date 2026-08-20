import { useUnit } from "effector-preact";
import { Globe, Moon, Sun } from "../icons";
import { $activeLocale, LocaleController } from "../i18n";
import { AVAILABLE_LANGS } from "../landing/i18n";
import { toggleTheme } from "../theme";
import { ActionMenu } from "./ActionMenu";

export function ThemeToggle() {
	return (
		<button
			class="top-bar-control"
			type="button"
			aria-label="Toggle color theme"
			title="Toggle color theme"
			onClick={toggleTheme}
		>
			<Moon class="top-bar-theme-icon top-bar-theme-icon-moon" size={16} />
			<Sun class="top-bar-theme-icon top-bar-theme-icon-sun" size={16} />
		</button>
	);
}

export function LanguageMenu() {
	const locale = useUnit($activeLocale);

	return (
		<ActionMenu
			label="Язык интерфейса"
			trigger={
				<>
					<Globe size={14} aria-hidden="true" />
					<span class="top-bar-locale">{locale.toUpperCase()}</span>
				</>
			}
			items={AVAILABLE_LANGS.map((lang) => ({
				id: lang.code,
				label: lang.name,
				checked: lang.code === locale,
			}))}
			onSelect={(code) => LocaleController.getInstance().setLocale(code)}
		/>
	);
}


export function TopBarSettings() {
	return (
		<>
			<LanguageMenu />
			<ThemeToggle />
		</>
	);
}
