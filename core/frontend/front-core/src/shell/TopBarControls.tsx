import { useUnit } from "effector-preact";
import { translator } from "i18n";
import { useEffect, useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import {
	onOperationAuthorizationChanged,
	operationAuthorizationSession,
	requestOperationAuthentication,
} from "../object-runtime";
import { Globe, LogIn, Moon, Sun } from "../icons";
import { $activeLocale, LocaleController } from "../i18n";
import { AVAILABLE_LANGS } from "../landing/i18n";
import { toggleTheme } from "../theme";
import { ActionMenu } from "./ActionMenu";
import { TopBarCommands } from "./topbar-commands";

const t = translator(CHAT_MESSAGES_NAMESPACE);

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
			label={t("topbar.interfaceLanguage")}
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

function LoginControl() {
	const [session, setSession] = useState(operationAuthorizationSession);

	useEffect(
		() => onOperationAuthorizationChanged(() => setSession(operationAuthorizationSession())),
		[],
	);

	if (session !== "guest") return null;

	return (
		<button
			class="top-bar-control"
			type="button"
			aria-label="Log in"
			title="Log in"
			onClick={() => void requestOperationAuthentication()}
		>
			<LogIn size={16} aria-hidden="true" />
		</button>
	);
}

export function TopBarSettings() {
	return (
		<>
			<TopBarCommands />
			<LoginControl />
			<LanguageMenu />
			<ThemeToggle />
		</>
	);
}
