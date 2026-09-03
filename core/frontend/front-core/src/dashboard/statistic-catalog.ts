import {
	Category,
	type DomainRef,
	loadObjectType,
	type ObjectTypeDefinition,
	objectRegistry,
	objectResolver,
	type StatisticDefinition,
	type StatisticWidgetSize,
	setRef,
} from "front-core/object-runtime";
import type { ComponentType } from "preact";

// One dashboard, assembled from the object catalog. Every statistic block is a
// type in `core.statistic`, so the build index already lists all of them before
// a single microfrontend is imported: the page can render its sections from the
// index and pull the owner's code only when a section is opened.

export type StatisticWidget = {
	typeId: string;
	label: string;
	description?: string;
	owner: string;
	/** Present only once the owning microfrontend has been imported. */
	statistic?: StatisticDefinition;
};

export type StatisticSection = {
	owner: string;
	label: string;
	/** The blocks shown once the section is opened. */
	widgets: StatisticWidget[];
	/** The readout shown while the section is collapsed, if the service has one. */
	summary?: StatisticWidget;
	/** The owner is imported, so `statistic.component` can be mounted. */
	loaded: boolean;
};

type OwnedType = ObjectTypeDefinition & { owner: string; loaded: boolean };

/**
 * `mf-companies` → `Companies`. The module name is the only grouping key that
 * exists for every type; a service does not publish a display name of its own.
 */
export function sectionLabel(owner: string): string {
	const name = owner.replace(/^(?:mf|ms)-/, "") || owner;
	return name
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function statisticOf(
	type: ObjectTypeDefinition,
): StatisticDefinition | undefined {
	const statistic = type.statistic;
	return statistic && typeof statistic === "object"
		? (statistic as StatisticDefinition)
		: undefined;
}

export function collectStatisticSections(): StatisticSection[] {
	const sections = new Map<string, StatisticSection>();

	for (const type of objectRegistry.allTypes() as OwnedType[]) {
		if (!type.categories?.includes(Category.Statistic)) continue;
		if (type.discover && !type.discover()) continue;

		const section = sections.get(type.owner) ?? {
			owner: type.owner,
			label: sectionLabel(type.owner),
			widgets: [],
			loaded: false,
		};
		section.loaded ||= type.loaded;
		const statistic = statisticOf(type);
		const widget: StatisticWidget = {
			typeId: type.id,
			label: type.label,
			description: type.description,
			owner: type.owner,
			statistic,
		};
		// The manifest carries `role` even though it cannot carry `component`, so
		// the page knows which services have a readout before importing any of them.
		if (statistic?.role === "summary") section.summary ??= widget;
		else section.widgets.push(widget);
		sections.set(type.owner, section);
	}

	return [...sections.values()]
		.map((section) => ({
			...section,
			widgets: [...section.widgets].sort((left, right) =>
				left.typeId.localeCompare(right.typeId),
			),
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * Imports the microfrontend owning a section. Registration bumps
 * `$objectRegistryRevision`, which is what re-runs `collectStatisticSections`
 * and turns the declared types into mountable components.
 */
export async function loadStatisticSection(
	section: StatisticSection,
): Promise<void> {
	const anyType = section.summary ?? section.widgets[0];
	if (!anyType) return;
	await loadObjectType(anyType.typeId);
}

/** A section lays out tiles, plus a full-width row for a whole-screen view. */
export type StatisticSlotSize = StatisticWidgetSize | "full";

export type MountableStatistic = {
	// biome-ignore lint/suspicious/noExplicitAny: mounted, never inspected
	Component: ComponentType<any>;
	props: Record<string, unknown>;
	size: StatisticSlotSize;
};

function wholeSetOf(typeId: string): DomainRef {
	return setRef(typeId, { kind: "query" });
}

/**
 * Resolves what to mount for one catalog entry, and returns nothing while the
 * owner is still unimported.
 *
 * Two shapes are in the catalog. A type that declares `statistic.component` is
 * one chart. A type that only declares itself statistical still has a view
 * accepting its set — the per-service statistics screen from before this page
 * existed — and rendering that view keeps such a service on the dashboard
 * instead of blank, without waiting for it to be split into blocks.
 */
export function resolveStatistic(
	widget: StatisticWidget,
): MountableStatistic | null {
	const component = widget.statistic?.component;
	if (component) {
		return {
			Component: component,
			props: widget.statistic?.props ?? {},
			size: widget.statistic?.size ?? "sm",
		};
	}

	const reference = wholeSetOf(widget.typeId);
	const view = objectResolver.resolveView(reference);
	if (!view?.component) return null;

	return {
		Component: view.component,
		props: { reference, ...(view.props?.(reference) ?? {}) },
		// A whole screen, not a tile: it gets the full row.
		size: "full",
	};
}
