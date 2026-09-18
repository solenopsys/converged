import { useUnit } from "effector-preact";
import { $objectRegistryRevision } from "front-core/object-runtime";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { StatisticActionsProvider } from "../dashboard/statistic-actions";
import {
	collectStatisticSections,
	resolveStatistic,
} from "../dashboard/statistic-catalog";
import { TabBar } from "../tabs";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import {
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	subtabReleased,
} from "./workspace";
import { menuBarText, surfaceMenuBar } from "./workspace-bars";

function SurfaceStatistics({ surface }: { surface: string }) {
	useUnit($objectRegistryRevision);
	const section = collectStatisticSections().find(
		(section) => section.owner === surface,
	);
	const widgets = (section?.widgets ?? [])
		.map((widget) => ({ widget, mounted: resolveStatistic(widget) }))
		.filter(
			(
				entry,
			): entry is {
				widget: (typeof section.widgets)[number];
				mounted: NonNullable<typeof entry.mounted>;
			} => entry.mounted !== null,
		);
	if (widgets.length === 0) return null;

	return (
		<div class="surface-home-statistics">
			{widgets.map(({ widget, mounted }) => (
				<section
					key={widget.typeId}
					class={
						mounted.size === "full"
							? "surface-statistic-full"
							: mounted.size === "lg"
								? "surface-statistic-wide"
								: "surface-statistic-tile"
					}
				>
					<StatisticActionsProvider
						actions={widget.statistic?.actions?.metrics}
					>
						<mounted.Component {...mounted.props} embedded />
					</StatisticActionsProvider>
				</section>
			))}
		</div>
	);
}

/**
 * The stage: the active surface, its bar, and whatever is open in it.
 *
 * The bar holds what the user pinned in this surface plus the one transient
 * tab; its catalog lists every projection and command. With the overview active
 * the surface shows its own screen — the resting state, and what the first
 * orchestrator step commits to, so it has to appear immediately.
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
	const { surface, pressed, tabs, release } = useUnit({
		surface: $activeSurface,
		pressed: $pressedSubtab,
		tabs: $surfaceTabs,
		release: subtabReleased,
	});

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			// Escape goes back to the overview rather than closing anything: the
			// surface stays, and so does whatever is pinned in it.
			if (event.key === "Escape" && surface && !event.defaultPrevented)
				release(surface);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [surface, release]);

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
			<div class="surface-bar">
				<TabBar model={surfaceMenuBar} theme="bar" text={menuBarText()} />
			</div>
			<div class="surface-content">
				{View ? (
					<View key={pressed?.key} {...(pressed?.props ?? {})} />
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
								{tab?.description ? <p>{tab.description}</p> : null}
							</>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
