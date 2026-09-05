import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { $objectRegistryRevision } from "front-core/object-runtime";
import {
	collectStatisticSections,
	resolveStatistic,
} from "../dashboard/statistic-catalog";
import { StatisticActionsProvider } from "../dashboard/statistic-actions";
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

function SurfaceStatistics({ surface }: { surface: string }) {
	useUnit($objectRegistryRevision);
	const section = collectStatisticSections().find(
		(section) => section.owner === surface,
	);
	const widgets = (section?.widgets ?? [])
		.map((widget) => ({ widget, mounted: resolveStatistic(widget) }))
		.filter(
			(entry): entry is { widget: (typeof section.widgets)[number]; mounted: NonNullable<typeof entry.mounted> } =>
				entry.mounted !== null,
		);
	if (widgets.length === 0) return null;

	return (
		<div class="surface-home-statistics">
			{widgets.map(({ widget, mounted }) => (
				<section
					key={widget.typeId}
					class={mounted.size === "full" ? "surface-statistic-full" : "surface-statistic-tile"}
				>
					<StatisticActionsProvider actions={widget.statistic?.actions?.metrics}>
						<mounted.Component {...mounted.props} embedded />
					</StatisticActionsProvider>
				</section>
			))}
		</div>
	);
}

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
						<SurfaceStatistics surface={surface} />
						{!collectStatisticSections().some(
							(section) =>
								section.owner === surface &&
								section.widgets.some((widget) => resolveStatistic(widget)),
						) && (
							<>
								<h1>{tab?.label ?? surface}</h1>
								{tab?.purpose ? <p>{tab.purpose}</p> : null}
							</>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
