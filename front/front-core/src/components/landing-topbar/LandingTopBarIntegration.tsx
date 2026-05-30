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
import { useGlobalTranslation } from "../../hooks/global_i18n";
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

	// Localize menu labels via the shared "nav" namespace; re-renders on
	// languageChanged so the top-bar nav follows the locale switch.
	const { t } = useGlobalTranslation("nav");
	const localizedMenuLinks = menuLinks.map((link) => ({
		href: link.href,
		label: link.labelKey ? t(link.labelKey, link.label) : link.label,
	}));

	return (
		<LandingTopBar
			logoLight={branding.logoLight}
			logoDark={branding.logoDark}
			phone={branding.phone}
			statusText={branding.statusText}
			actions={actions}
			menuLinks={localizedMenuLinks}
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
