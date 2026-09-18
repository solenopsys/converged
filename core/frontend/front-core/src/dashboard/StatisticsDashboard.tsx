import { useUnit } from "effector-preact";
import { invokeAction } from "front-core/core";
import { translator } from "i18n";
import { useEffect } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { ContentContainer } from "../components/ContentContainer";
import { ChevronDown, ChevronRight, Plus, RotateCcw, X } from "../icons";
import { cn } from "../lib/utils";
import { CatalogMenu } from "../tabs";
import {
	$collapsed,
	$hiddenWidgets,
	$homeSections,
	$loadingOwners,
	homeMenu,
	homeSections,
	homeShown,
	sectionToggled,
	widgetHidden,
	widgetsRestored,
} from "./home";
import { StatisticActionsProvider } from "./statistic-actions";
import {
	resolveStatistic,
	type StatisticSection,
	type StatisticWidget,
} from "./statistic-catalog";

const t = translator(CHAT_MESSAGES_NAMESPACE);

function Widget({
	widget,
	onHide,
}: {
	widget: StatisticWidget;
	onHide: () => void;
}) {
	const mounted = resolveStatistic(widget);

	return (
		<div
			className={cn(
				"group relative min-h-40",
				mounted?.size === "lg" && "md:col-span-2 md:row-span-2",
				mounted?.size === "full" && "col-span-full min-h-[32rem]",
			)}
		>
			{mounted ? (
				<StatisticActionsProvider actions={widget.statistic?.actions?.metrics}>
					<mounted.Component {...mounted.props} />
				</StatisticActionsProvider>
			) : (
				<div className="flex h-full flex-col justify-center rounded-xl border bg-muted/20 px-3 py-2.5 text-sm">
					<div className="font-medium text-foreground">{widget.label}</div>
					<div className="mt-1 text-xs leading-5 text-muted-foreground">
						{t("statistics.widgetUnavailable")}
					</div>
				</div>
			)}
			<button
				type="button"
				aria-label={t("statistics.hideWidget", { title: widget.label })}
				title={t("statistics.hideWidget", { title: widget.label })}
				className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
				onClick={onHide}
			>
				<X aria-hidden="true" className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

/**
 * The collapsed section's readout. It mounts the service's declared summary
 * component, which owns its own numbers and trend line — this page only gives
 * it a slot and a skeleton to occupy while its module is still loading.
 */
function SectionReadout({
	section,
	loading,
}: {
	section: StatisticSection;
	loading: boolean;
}) {
	const mounted = section.summary ? resolveStatistic(section.summary) : null;

	if (mounted)
		return (
			<StatisticActionsProvider
				actions={section.summary?.statistic?.actions?.metrics}
			>
				<mounted.Component {...mounted.props} />
			</StatisticActionsProvider>
		);
	if (!section.summary) return null;

	return (
		<div
			role="status"
			className="h-7 w-48 animate-pulse rounded bg-muted/40"
			aria-label={loading ? t("statistics.loadingSummary") : undefined}
		/>
	);
}

function Section({
	section,
	expanded,
	loading,
	hidden,
}: {
	section: StatisticSection;
	expanded: boolean;
	loading: boolean;
	hidden: ReadonlySet<string>;
}) {
	const { toggle, hide, restore, remove } = useUnit({
		toggle: sectionToggled,
		hide: widgetHidden,
		restore: widgetsRestored,
		remove: homeSections.closed,
	});
	const visible = section.widgets.filter(
		(widget) => !hidden.has(widget.typeId),
	);
	const hiddenCount = section.widgets.length - visible.length;
	const Chevron = expanded ? ChevronDown : ChevronRight;
	const toggleLabel = expanded
		? t("statistics.collapse", { title: section.label })
		: t("statistics.expand", { title: section.label });
	const removeLabel = t("statistics.removeSection", { title: section.label });

	return (
		<section className="home-section rounded-xl border bg-card">
			<div className="flex items-center gap-4 px-4 py-3">
				<button
					type="button"
					className="shrink-0 text-muted-foreground"
					aria-expanded={expanded}
					aria-label={toggleLabel}
					title={toggleLabel}
					onClick={() => toggle(section.owner)}
				>
					<Chevron
						aria-hidden="true"
						className="h-4 w-4 shrink-0 text-muted-foreground"
					/>
				</button>
				<button
					type="button"
					className={cn(
						"w-36 shrink-0 truncate text-left font-semibold md:w-48",
						section.summary?.statistic?.actions?.title &&
							"text-primary underline decoration-dotted underline-offset-4 hover:no-underline",
					)}
					onClick={() => {
						const actionId = section.summary?.statistic?.actions?.title;
						if (actionId) void invokeAction(actionId);
						else toggle(section.owner);
					}}
				>
					{section.label}
				</button>
				<span className="ml-2 text-sm text-muted-foreground">
					{visible.length}
				</span>

				{/* The readout stays up whether the section is open or shut: it is what
				    makes a collapsed section worth keeping on the home screen. */}
				<div className="min-w-0 flex-1 overflow-hidden">
					<SectionReadout section={section} loading={loading} />
				</div>
				{hiddenCount > 0 ? (
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
						title={t("statistics.restoreHidden", { count: hiddenCount })}
						onClick={() =>
							restore(section.widgets.map((widget) => widget.typeId))
						}
					>
						<RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
						{hiddenCount}
					</button>
				) : null}
				<button
					type="button"
					className="home-section-remove inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
					aria-label={removeLabel}
					title={removeLabel}
					onClick={() => remove(section.owner)}
				>
					<X aria-hidden="true" className="h-3.5 w-3.5" />
				</button>
			</div>

			{expanded ? (
				<div className="border-t px-4 py-4">
					{loading ? (
						<p className="text-sm text-muted-foreground">
							{t("statistics.loadingSection")}
						</p>
					) : visible.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t("statistics.allHidden")}
						</p>
					) : (
						<div className="grid auto-rows-[minmax(10rem,auto)] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
							{visible.map((widget) => (
								<Widget
									key={widget.typeId}
									widget={widget}
									onHide={() => hide(widget.typeId)}
								/>
							))}
						</div>
					)}
				</div>
			) : null}
		</section>
	);
}

/**
 * The home screen: the sections the user added, each collapsible, and a "+"
 * with every other section. Nothing is imported for a section that is not
 * here — adding one is what loads its surface.
 */
export function StatisticsDashboard() {
	const { sections, collapsed, hidden, loading, pinToggled, shown } = useUnit({
		sections: $homeSections,
		collapsed: $collapsed,
		hidden: $hiddenWidgets,
		loading: $loadingOwners,
		pinToggled: homeSections.pinToggled,
		shown: homeShown,
	});

	useEffect(() => {
		shown();
	}, [shown]);

	const hiddenSet = new Set<string>(hidden);
	const addLabel = t("statistics.addSection");

	return (
		<ContentContainer className="flex flex-col gap-3 p-4">
			<div className="home-toolbar">
				<CatalogMenu
					model={homeMenu}
					onPinToggle={pinToggled}
					trigger={
						<>
							<Plus size={14} aria-hidden="true" />
							<span>{addLabel}</span>
						</>
					}
					text={{
						label: addLabel,
						search: t("tab.search"),
						empty: t("tab.nothingFound"),
						pin: (title) => t("tab.pinNamed", { title }),
						unpin: (title) => t("tab.unpinNamed", { title }),
					}}
				/>
			</div>
			{sections.length === 0 ? (
				<p className="p-4 text-sm text-muted-foreground">
					{t("statistics.homeEmpty")}
				</p>
			) : (
				sections.map((section) => (
					<Section
						key={section.owner}
						section={section}
						expanded={!collapsed.includes(section.owner)}
						loading={loading.includes(section.owner)}
						hidden={hiddenSet}
					/>
				))
			)}
		</ContentContainer>
	);
}
