import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { X } from "../icons";
import type { WorkspaceSubtab } from "./workspace";

const t = translator(CHAT_MESSAGES_NAMESPACE);

/**
 * The second level: the buttons of the active surface.
 *
 * Usually none is pressed — the surface shows its own screen — so pressing the
 * pressed one releases it rather than doing nothing. Permanent buttons are the
 * surface's own views and cannot be closed; dynamic ones are what someone
 * opened (a row, an object, a selection) and can.
 */
export function SubtabBar({
	subtabs,
	pressed,
	onPress,
	onRelease,
	onClose,
}: {
	subtabs: readonly WorkspaceSubtab[];
	pressed: string | null;
	onPress: (key: string) => void;
	onRelease: () => void;
	onClose: (key: string) => void;
}) {
	if (subtabs.length === 0) return null;

	return (
		<div class="subtab-bar" role="tablist" aria-label={t("tab.subtabs")}>
			{subtabs.map((subtab) => {
				const isPressed = subtab.key === pressed;
				return (
					<div
						class="subtab"
						key={subtab.key}
						data-pressed={isPressed ? "true" : undefined}
						data-permanent={subtab.permanent ? "true" : undefined}
					>
						<button
							type="button"
							class="subtab-select"
							role="tab"
							aria-selected={isPressed}
							title={subtab.title}
							onClick={() => (isPressed ? onRelease() : onPress(subtab.key))}
						>
							{subtab.title}
						</button>
						{subtab.permanent ? null : (
							<button
								type="button"
								class="subtab-close"
								aria-label={t("tab.closeNamed", { title: subtab.title })}
								title={t("tab.closeTab")}
								onClick={() => onClose(subtab.key)}
							>
								<X size={11} aria-hidden="true" />
							</button>
						)}
					</div>
				);
			})}
		</div>
	);
}
