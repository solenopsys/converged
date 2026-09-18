import { createEffect, sample } from "effector";
import { useUnit } from "effector-preact";
import { translator } from "i18n";
import { useEffect, useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { $activeLocale, LocaleController } from "../i18n";
import { Globe, LogIn, Moon, Sun } from "../icons";
import { AVAILABLE_LANGS } from "../landing/i18n";
import {
	onOperationAuthorizationChanged,
	operationAuthorizationSession,
	requestOperationAuthentication,
} from "../object-runtime";
import { ChoiceMenuButton, createChoiceMenu } from "../tabs";
import { toggleTheme } from "../theme";

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

const languageMenu = createChoiceMenu("LANGUAGE_MENU");

sample({
	clock: languageMenu.chosen,
	target: createEffect((code: string) =>
		LocaleController.getInstance().setLocale(code),
	),
});

export function LanguageMenu() {
	const locale = useUnit($activeLocale);

	return (
		<ChoiceMenuButton
			model={languageMenu}
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
		/>
	);
}

function LoginControl() {
	const [session, setSession] = useState(operationAuthorizationSession);

	useEffect(
		() =>
			onOperationAuthorizationChanged(() =>
				setSession(operationAuthorizationSession()),
			),
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
			<LoginControl />
			<LanguageMenu />
			<ThemeToggle />
		</>
	);
}
