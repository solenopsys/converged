import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { SubtabBar } from "./SubtabBar";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	subtabActivated,
	subtabClosed,
	subtabReleased,
} from "./workspace";

/**
 * The stage: the active surface, its button bar, and whatever is pressed.
 *
 * With nothing pressed the surface shows its own screen. That state is the
 * normal one, not an empty one — it is what the first orchestrator step commits
 * to, a second after the user asked for something, and it has to be cheap
 * enough to appear immediately.
 */
export function Surface({
	brand,
	brandHref,
	onBrandClick,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
}) {
	const surface = useUnit($activeSurface);
	const subtabs = useUnit($activeSubtabs);
	const pressed = useUnit($pressedSubtab);
	const tabs = useUnit($surfaceTabs);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			// Escape releases the button rather than closing the tab: the surface
			// stays, which is what "usually none is pressed" means.
			if (event.key === "Escape" && surface) subtabReleased(surface);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [surface]);

	if (!surface) return null;

	const tab = tabs.find((entry) => entry.id === surface);
	const View = pressed?.view;

	return (
		<section class="surface">
			<WorkspaceTopBar
				brand={brand}
				brandHref={brandHref}
				onBrandClick={onBrandClick}
			/>
			<SubtabBar
				subtabs={subtabs}
				pressed={pressed?.key ?? null}
				onPress={subtabActivated}
				onRelease={() => subtabReleased(surface)}
				onClose={subtabClosed}
			/>
			<div class="surface-content">
				{View ? (
					<View {...(pressed?.props ?? {})} />
				) : (
					<div class="surface-home">
						<h1>{tab?.label ?? surface}</h1>
						{tab?.purpose ? <p>{tab.purpose}</p> : null}
					</div>
				)}
			</div>
		</section>
	);
}
