import { useUnit } from "effector-preact";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { TabBar } from "../tabs";
import { $activeSurface } from "./workspace";
import {
	menuBarText,
	navMenuList,
	navSurfaceList,
	surfaceBarText,
} from "./workspace-bars";

const t = translator(CHAT_MESSAGES_NAMESPACE);

/**
 * Navigation over both levels, as vertical lists: the sections, then what is
 * in the active one.
 *
 * This is the whole content of the panel's navigation tab, and on a phone it is
 * the only navigation there is — the panel covers the viewport (`panel.css`),
 * so the strip above it cannot be reached while the chat is open. The same tab
 * sets as the strip and the bar, drawn in the `list` theme: pinning here pins
 * there, and what the orchestrator opens is marked in both.
 */
export function SurfaceNav() {
	const surface = useUnit($activeSurface);

	return (
		<div class="surface-nav">
			<section class="surface-nav-group">
				<h2 class="surface-nav-heading">{t("tab.sections")}</h2>
				<TabBar model={navSurfaceList} theme="list" text={surfaceBarText()} />
			</section>
			{surface ? (
				<section class="surface-nav-group">
					<h2 class="surface-nav-heading">{t("nav.current")}</h2>
					<TabBar model={navMenuList} theme="list" text={menuBarText()} />
				</section>
			) : null}
		</div>
	);
}
