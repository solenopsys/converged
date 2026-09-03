import { useUnit } from "effector-preact";
import { invokeAction } from "front-core/core";
import { $objectRegistryRevision } from "front-core/object-runtime";
import { translator } from "i18n";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { ChevronDown, ChevronRight, RotateCcw, X } from "../icons";
import { cn } from "../lib/utils";
import { StatisticActionsProvider } from "./statistic-actions";
import {
	collectStatisticSections,
	loadStatisticSection,
	resolveStatistic,
	type StatisticSection,
	type StatisticWidget,
} from "./statistic-catalog";
import {
	hideWidget,
	readStatisticPreferences,
	restoreWidgets,
	type StatisticPreferences,
	toggleSection,
	writeStatisticPreferences,
} from "./statistic-preferences";

const t = translator(CHAT_MESSAGES_NAMESPACE);
const SUMMARY_LOAD_CONCURRENCY = 3;

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
	onToggle,
	onHideWidget,
	onRestore,
}: {
	section: StatisticSection;
	expanded: boolean;
	loading: boolean;
	hidden: ReadonlySet<string>;
	onToggle: () => void;
	onHideWidget: (typeId: string) => void;
	onRestore: () => void;
}) {
	const visible = section.widgets.filter(
		(widget) => !hidden.has(widget.typeId),
	);
	const hiddenCount = section.widgets.length - visible.length;
	const Chevron = expanded ? ChevronDown : ChevronRight;

	return (
		<section className="rounded-xl border bg-card">
			<div className="flex items-center gap-4 px-4 py-3">
				<button
					type="button"
					className="shrink-0 text-muted-foreground"
					aria-expanded={expanded}
					onClick={onToggle}
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
						else onToggle();
					}}
				>
					{section.label}
				</button>
				<span className="ml-2 text-sm text-muted-foreground">
					{visible.length}
				</span>

				{/* The readout stays up whether the section is open or shut: it is what
				    makes a fully collapsed dashboard worth looking at. */}
				<div className="min-w-0 flex-1 overflow-hidden">
					<SectionReadout section={section} loading={loading} />
				</div>
				{hiddenCount > 0 ? (
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
						title={t("statistics.restoreHidden", { count: hiddenCount })}
						onClick={onRestore}
					>
						<RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
						{hiddenCount}
					</button>
				) : null}
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
									onHide={() => onHideWidget(widget.typeId)}
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
 * The whole admin's statistics on one page: a section per microfrontend, every
 * one collapsed to start with. Nothing but the section headers is rendered
 * until a section is opened — that is also when its microfrontend is imported.
 */
export function StatisticsDashboard() {
	const revision = useUnit($objectRegistryRevision);
	const [preferences, setPreferences] = useState<StatisticPreferences>(
		readStatisticPreferences,
	);
	const [loadingOwners, setLoadingOwners] = useState<readonly string[]>([]);
	// Owners an import has already been started for, so neither a click nor the
	// background pass asks for the same module twice.
	const requested = useRef<Set<string>>(new Set());

	const sections = useMemo(() => collectStatisticSections(), [revision]);

	const expanded = new Set(preferences.expanded);
	const hidden = new Set(preferences.hidden);

	const update = (next: StatisticPreferences) => {
		setPreferences(writeStatisticPreferences(next));
	};

	const load = (section: StatisticSection) => {
		if (section.loaded || requested.current.has(section.owner)) return;
		requested.current.add(section.owner);

		setLoadingOwners((owners) => [...owners, section.owner]);
		void loadStatisticSection(section)
			.catch((error) => {
				// Let a later interaction retry a service that failed to load.
				requested.current.delete(section.owner);
				console.error("[statistics] Failed to load section", {
					owner: section.owner,
					error,
				});
			})
			.finally(() => {
				setLoadingOwners((owners) =>
					owners.filter((owner) => owner !== section.owner),
				);
			});
	};

	const toggle = (section: StatisticSection) => {
		update(toggleSection(preferences, section.owner));
		if (!expanded.has(section.owner)) load(section);
	};

	// A service that publishes a readout is fetched without waiting to be opened
	// — the point of the readout is that a collapsed dashboard already shows the
	// numbers. A small pool avoids a long skeleton queue while keeping imports and
	// each summary's initial aggregate request from arriving all at once.
	useEffect(() => {
		const pending = sections
			.filter(
				(section) =>
					section.summary &&
					!section.loaded &&
					!requested.current.has(section.owner),
			)
			.slice(0, SUMMARY_LOAD_CONCURRENCY);
		if (pending.length === 0) return;

		const start = () => pending.forEach(load);
		if (typeof requestIdleCallback !== "function") {
			const timer = setTimeout(start, 0);
			return () => clearTimeout(timer);
		}
		const idle = requestIdleCallback(start, { timeout: 2000 });
		return () => cancelIdleCallback(idle);
	}, [sections]);

	if (sections.length === 0) {
		return (
			<p className="p-4 text-sm text-muted-foreground">
				{t("statistics.empty")}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-4">
			{sections.map((section) => (
				<Section
					key={section.owner}
					section={section}
					expanded={expanded.has(section.owner)}
					loading={loadingOwners.includes(section.owner)}
					hidden={hidden}
					onToggle={() => toggle(section)}
					onHideWidget={(typeId) => update(hideWidget(preferences, typeId))}
					onRestore={() =>
						update(
							restoreWidgets(
								preferences,
								section.widgets.map((widget) => widget.typeId),
							),
						)
					}
				/>
			))}
		</div>
	);
}
