import { useUnit } from "effector-preact";
import { translator } from "i18n";
import { useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Pin, X } from "../icons";
import { allSurfaceNav, groupSurfaceNav } from "./surface-nav";
import {
	$surfaceTabs,
	$workspaceSubtabs,
	subtabActivated,
	subtabClosed,
	subtabReleased,
	surfaceMounted,
	surfacePinToggled,
} from "./workspace";

const t = translator(CHAT_MESSAGES_NAMESPACE);

/**
 * Navigation over both levels: surfaces, and the buttons of each.
 *
 * This is the whole content of the panel's navigation tab, and on a phone it is
 * the only navigation there is — the panel covers the viewport (`panel.css`),
 * so the tab strip above it cannot be reached while the chat is open. It is
 * also where a step's commit becomes visible on mobile: the surface the
 * orchestrator just mounted and the button it just pressed are marked here.
 */
export function SurfaceNav() {
	const tabs = useUnit($surfaceTabs);
	const subtabs = useUnit($workspaceSubtabs);
	// What is open, and nothing else. Listing every registered section on sight
	// is a wall of things most people have no use for; the rest is one click
	// away, behind "show all", and even that is filtered by the session's rights.
	const [showAll, setShowAll] = useState(false);
	const groups = showAll
		? allSurfaceNav(tabs, subtabs)
		: groupSurfaceNav(tabs, subtabs);
	const more = allSurfaceNav(tabs, subtabs).length - tabs.length;

	if (groups.length === 0 && more === 0) {
		return <p class="panel-empty-state">{t("nav.empty")}</p>;
	}

	return (
		<div class="surface-nav">
			{groups.map((group) => (
				<section
					class="surface-nav-group"
					key={group.surface}
					data-active={group.active ? "true" : undefined}
				>
					<header class="surface-nav-head">
						<button
							type="button"
							class="surface-nav-open"
							title={group.purpose}
							aria-current={group.active ? "true" : undefined}
							onClick={() => surfaceMounted(group.surface)}
						>
							{group.label}
						</button>
						<button
							type="button"
							class="surface-nav-pin"
							aria-label={t("tab.pinTab")}
							title={t("tab.pinTab")}
							aria-pressed={
								tabs.find((tab) => tab.id === group.surface)?.pinned ?? false
							}
							onClick={() => surfacePinToggled(group.surface)}
						>
							<Pin aria-hidden="true" size={14} />
						</button>
					</header>
					{group.subtabs.length > 0 ? (
						<ol class="surface-nav-subtabs">
							{group.subtabs.map((subtab) => (
								<li
									key={subtab.key}
									data-pressed={
										subtab.key === group.pressed ? "true" : undefined
									}
								>
									<button
										type="button"
										class="surface-nav-subtab"
										aria-pressed={subtab.key === group.pressed}
										onClick={() =>
											subtab.key === group.pressed
												? subtabReleased(group.surface)
												: subtabActivated(subtab.key)
										}
									>
										{subtab.title}
									</button>
									{subtab.permanent ? null : (
										<button
											type="button"
											class="surface-nav-close"
											aria-label={t("tab.closeNamed", { title: subtab.title })}
											title={t("tab.closeTab")}
											onClick={() => subtabClosed(subtab.key)}
										>
											<X aria-hidden="true" size={14} />
										</button>
									)}
								</li>
							))}
						</ol>
					) : null}
				</section>
			))}
			{!showAll && more > 0 ? (
				<button
					type="button"
					class="surface-nav-more"
					onClick={() => setShowAll(true)}
				>
					{t("nav.showAll", { count: more })}
				</button>
			) : null}
		</div>
	);
}

export type { SurfaceNavGroup } from "./surface-nav";
export { allSurfaceNav, groupSurfaceNav } from "./surface-nav";
