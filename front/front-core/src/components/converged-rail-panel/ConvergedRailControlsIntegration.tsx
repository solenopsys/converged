import { useUnit } from "effector-react";
import {
	$isAuthenticated,
	$lang,
	$languages,
	$loginEnabled,
	$theme,
	collapseRequested,
	langChanged,
	loginRequested,
	logoutRequested,
	themeToggled,
} from "../../landing-common/control-panel-model";
import { ConvergedRailControls } from "./ConvergedRailControls";

export function ConvergedRailControlsIntegration() {
	const [theme, lang, languages, loginEnabled, isAuthenticated] = useUnit([
		$theme,
		$lang,
		$languages,
		$loginEnabled,
		$isAuthenticated,
	]);
	const [toggle, change, login, logout, collapse] = useUnit([
		themeToggled,
		langChanged,
		loginRequested,
		logoutRequested,
		collapseRequested,
	]);

	return (
		<ConvergedRailControls
			theme={theme}
			onThemeToggle={() => toggle()}
			languages={languages}
			currentLanguage={lang}
			onLanguageChange={change}
			loginEnabled={loginEnabled}
			isAuthenticated={isAuthenticated}
			onLogin={() => login()}
			onLogout={() => logout()}
			onCollapse={isAuthenticated ? undefined : () => collapse()}
		/>
	);
}
