import { useUnit } from "effector-react";
import {
	$branding,
	$composerValue,
	$lang,
	$languages,
	$loginEnabled,
	$menuLinks,
	$panelActions,
	$theme,
	chatOpenRequested,
	composerAttachRequested,
	composerCleared,
	composerValueChanged,
	controlPanelOpened,
	langChanged,
	loginRequested,
	themeToggled,
} from "../../landing-common/control-panel-model";
import { LandingTopBar } from "./LandingTopBar";

export interface LandingTopBarIntegrationProps {
	compact?: boolean;
}

export function LandingTopBarIntegration({ compact }: LandingTopBarIntegrationProps = {}) {
	const [branding, menuLinks, languages, lang, theme, actions, composer, loginEnabled] = useUnit([
		$branding,
		$menuLinks,
		$languages,
		$lang,
		$theme,
		$panelActions,
		$composerValue,
		$loginEnabled,
	]);

	return (
		<LandingTopBar
			logoLight={branding.logoLight}
			logoDark={branding.logoDark}
			phone={branding.phone}
			statusText={branding.statusText}
			actions={actions}
			menuLinks={menuLinks}
			languages={languages}
			currentLanguage={lang}
			onLanguage={langChanged}
			isDark={theme === "dark"}
			onThemeToggle={() => themeToggled()}
			onLogin={loginEnabled ? () => loginRequested() : undefined}
			onPanelOpen={() => controlPanelOpened()}
			value={composer}
			onValueChange={composerValueChanged}
			onSubmit={(text) => {
				chatOpenRequested(text);
				composerCleared();
				controlPanelOpened();
			}}
			onAttach={() => composerAttachRequested()}
			compact={compact}
		/>
	);
}
