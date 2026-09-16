import {
	combine,
	createEffect,
	createEvent,
	createStore,
	sample,
} from "effector";
import {
	$availableSurfaces,
	$objectRegistryRevision,
	objectRegistry,
} from "front-core/object-runtime";
import { $activeLocale, $localeCatalogRevision } from "../i18n";
import { type CatalogItem, createCatalogMenu, createTabSet } from "../tabs";
import {
	collectStatisticSections,
	loadStatisticSection,
	type StatisticSection,
} from "./statistic-catalog";

// The home screen: the statistic sections the user put there, and nothing else.
//
// It used to render every section in the catalog — fifteen headers already, and
// every installed solution adds more. The sections are now a tabbed place like
// the strip, only without a transient slot: adding a section from "+" pins it,
// removing it unpins it. A new user starts with an empty screen and the "+".

const $sections = combine(
	$objectRegistryRevision,
	$availableSurfaces,
	$activeLocale,
	$localeCatalogRevision,
	(): readonly StatisticSection[] => collectStatisticSections(),
);

const $catalog = combine(
	$sections,
	$availableSurfaces,
	(sections, available): CatalogItem[] => {
		const offered = new Map(available.map((surface) => [surface.id, surface]));
		return sections
			.map((section) => {
				const surface = offered.get(section.owner);
				const description = surface?.purpose;
				return {
					id: section.owner,
					// A surface names itself; the id-derived label is the last resort.
					label:
						surface?.label ??
						objectRegistry.surface(section.owner)?.label ??
						section.label,
					...(description ? { description } : {}),
				};
			})
			.sort((left, right) => left.label.localeCompare(right.label));
	},
);

export const homeSections = createTabSet({
	name: "HOME_SECTIONS",
	$catalog,
	transient: false,
});

export const homeMenu = createCatalogMenu({
	name: "HOME_ADD",
	$items: homeSections.$entries,
});
sample({ clock: homeMenu.chosen, target: homeSections.opened });

/** The pinned sections, in the order the user added them. */
export const $homeSections = combine(
	homeSections.$tabs,
	$sections,
	(tabs, sections) => {
		const byOwner = new Map(
			sections.map((section) => [section.owner, section]),
		);
		return tabs.flatMap((tab) => {
			const section = byOwner.get(tab.id);
			return section ? [{ ...section, label: tab.label }] : [];
		});
	},
);

// --- view preferences ---------------------------------------------------------
// Which sections are collapsed and which charts are hidden. Session storage,
// not the environment service: this is how the page looks right now, not what
// the user keeps — losing it on a new session costs a click.

const STORAGE_KEY = "front-core:home-view";

type HomeView = { collapsed: string[]; hidden: string[] };

function storage(): Storage | null {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		// Storage access throws outright when the browser blocks it for the origin.
		return null;
	}
}

const strings = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];

function readView(): HomeView {
	try {
		const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "{}");
		return {
			collapsed: strings(parsed.collapsed),
			hidden: strings(parsed.hidden),
		};
	} catch {
		return { collapsed: [], hidden: [] };
	}
}

const toggle = (list: readonly string[], value: string): string[] =>
	list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];

export const sectionToggled = createEvent<string>("HOME_SECTION_TOGGLED");
export const widgetHidden = createEvent<string>("HOME_WIDGET_HIDDEN");
export const widgetsRestored = createEvent<readonly string[]>(
	"HOME_WIDGETS_RESTORED",
);

const initial = readView();

/** Pinned sections start open: the user put them there to look at them. */
export const $collapsed = createStore<readonly string[]>(initial.collapsed, {
	name: "HOME_COLLAPSED",
}).on(sectionToggled, toggle);

export const $hiddenWidgets = createStore<readonly string[]>(initial.hidden, {
	name: "HOME_HIDDEN_WIDGETS",
})
	.on(widgetHidden, (hidden, typeId) =>
		hidden.includes(typeId) ? hidden : [...hidden, typeId],
	)
	.on(widgetsRestored, (hidden, typeIds) =>
		hidden.filter((typeId) => !typeIds.includes(typeId)),
	);

export const writeViewFx = createEffect((view: HomeView) => {
	storage()?.setItem(STORAGE_KEY, JSON.stringify(view));
});

sample({
	clock: [$collapsed.updates, $hiddenWidgets.updates],
	source: { collapsed: $collapsed, hidden: $hiddenWidgets },
	fn: ({ collapsed, hidden }) => ({
		collapsed: [...collapsed],
		hidden: [...hidden],
	}),
	target: writeViewFx,
});

// --- loading ----------------------------------------------------------------------
// A section's module is imported when it is on the home screen and there is
// something to show: its readout, or its charts once it is open.

/** The home screen was drawn; checks what it needs even if nothing changed. */
export const homeShown = createEvent("HOME_SHOWN");

export const loadSectionsFx = createEffect(
	async (sections: readonly StatisticSection[]) => {
		const results = await Promise.allSettled(
			sections.map((section) => loadStatisticSection(section)),
		);
		results.forEach((result, index) => {
			if (result.status === "rejected") {
				console.error("[home] Failed to load section", {
					owner: sections[index]?.owner,
					error: result.reason,
				});
			}
		});
	},
);

/**
 * Owners an import was started for. A failed one stays here: asking again on
 * every store update would loop, and reopening the page is the retry.
 */
const $requested = createStore<readonly string[]>([], {
	name: "HOME_REQUESTED",
}).on(loadSectionsFx, (owners, sections) => [
	...owners,
	...sections.map((section) => section.owner),
]);

export const $loadingOwners = createStore<readonly string[]>([], {
	name: "HOME_LOADING",
})
	.on(loadSectionsFx, (owners, sections) => [
		...owners,
		...sections.map((section) => section.owner),
	])
	.on(loadSectionsFx.finally, (owners, { params }) =>
		owners.filter(
			(owner) => !params.some((section) => section.owner === owner),
		),
	);

const $pending = combine(
	$homeSections,
	$collapsed,
	$requested,
	(sections, collapsed, requested) =>
		sections.filter(
			(section) =>
				!section.loaded &&
				!requested.includes(section.owner) &&
				(Boolean(section.summary) || !collapsed.includes(section.owner)),
		),
);

sample({
	clock: [$pending.updates, homeShown],
	source: $pending,
	filter: (pending) => pending.length > 0,
	target: loadSectionsFx,
});
