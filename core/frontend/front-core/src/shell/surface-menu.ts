import {
	Category,
	localized,
	objectRegistry,
	type SurfaceMenuItem,
	type ViewDefinition,
} from "front-core/object-runtime";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import type { CatalogItem } from "../tabs";

const t = translator(CHAT_MESSAGES_NAMESPACE);

/** The surface's own screen: its summary, dashboard, statistics. */
export const OVERVIEW = "overview";

/** A stable identity for a view a surface exposes before anything is opened. */
export const projectionKey = (viewId: string): string => `view:${viewId}`;
export const commandKey = (operationId: string): string => `op:${operationId}`;

export const viewIdOf = (key: string): string | undefined =>
	key.startsWith("view:") ? key.slice("view:".length) : undefined;
export const operationIdOf = (key: string): string | undefined =>
	key.startsWith("op:") ? key.slice("op:".length) : undefined;

type OwnedView = ViewDefinition & { owner: string };

export function projectionLabel(view: OwnedView): string {
	const typeId = view.accepts.type;
	const type = typeId ? objectRegistry.type(typeId) : undefined;
	if (view.labelKey) {
		return localized(view.owner, view.labelKey, view.label) ?? view.id;
	}
	// A table labelled with its type's plural restates the type, and the type is
	// what the surface translates. Only a label of its own ("Board") is kept.
	const restated =
		!view.label ||
		view.label === type?.pluralLabel ||
		view.label === type?.label;
	if (!restated) return view.label as string;
	return (
		localized(view.owner, type?.pluralLabelKey, type?.pluralLabel) ??
		localized(view.owner, type?.labelKey, type?.label) ??
		view.label ??
		view.id
	);
}

/** What a projection shows: its own line, else what its type is. */
export function projectionDescription(view: OwnedView): string | undefined {
	const typeId = view.accepts.type;
	const type = typeId ? objectRegistry.type(typeId) : undefined;
	return (
		localized(view.owner, view.descriptionKey, view.description) ??
		localized(view.owner, type?.descriptionKey, type?.description)
	);
}

function projectionIcon(view: OwnedView): string {
	const type = view.accepts.type
		? objectRegistry.type(view.accepts.type)
		: undefined;
	return type?.infinity ||
		view.presentation === "table" ||
		view.id.endsWith(".table")
		? "Table"
		: "Tool";
}

/**
 * A menu for a surface that has not declared one: its set views, then its
 * create operations. Statistic types are left out — they are what the overview
 * already shows, and listing them again is the clutter the menu exists to end.
 */
function derivedMenu(surface: string): SurfaceMenuItem[] {
	const views = objectRegistry
		.allViews()
		.filter(
			(view) =>
				view.owner === surface &&
				view.accepts.kind === "set" &&
				Boolean(view.accepts.type) &&
				!objectRegistry.hasCategory(
					view.accepts.type as string,
					Category.Statistic,
				),
		)
		.sort(
			(left, right) =>
				(right.priority ?? 0) - (left.priority ?? 0) ||
				left.id.localeCompare(right.id),
		)
		.map((view) => ({ view: view.id }));
	const commands = objectRegistry
		.allOperations()
		.filter(
			(operation) =>
				operation.owner === surface && operation.operator === "create",
		)
		.sort(
			(left, right) =>
				(right.priority ?? 0) - (left.priority ?? 0) ||
				left.label.localeCompare(right.label),
		)
		.map((operation) => ({ operation: operation.id }));
	return [...views, ...commands];
}

/**
 * Everything the catalog menu of one surface offers: its overview, the
 * projections, the commands. Pure over the registry, so the workspace can
 * recompute it whenever the registry, the rights or the language change.
 */
export function surfaceMenu(surface: string): CatalogItem[] {
	const identity = objectRegistry.surface(surface);
	const declared = identity?.menu;
	const purpose = identity
		? localized(surface, identity.purposeKey, identity.purpose)
		: undefined;
	const items: CatalogItem[] = [
		{
			id: OVERVIEW,
			label: t("tab.overview"),
			// The overview is the surface's own screen, so it says what the surface is for.
			...(purpose ? { description: purpose } : {}),
			icon: "Gauge",
		},
	];
	const seen = new Set<string>([OVERVIEW]);

	for (const entry of declared ?? derivedMenu(surface)) {
		if ("view" in entry) {
			const view = objectRegistry.view(entry.view);
			if (!view) continue;
			const id = projectionKey(view.id);
			if (seen.has(id)) continue;
			seen.add(id);
			const description = projectionDescription(view);
			items.push({
				id,
				label: projectionLabel(view),
				...(description ? { description } : {}),
				icon: projectionIcon(view),
				group: t("tab.groupViews"),
				...(entry.pinned ? { pinned: true } : {}),
			});
			continue;
		}
		const operation = objectRegistry.operation(entry.operation);
		if (!operation || !(operation.discover?.() ?? true)) continue;
		const id = commandKey(operation.id);
		if (seen.has(id)) continue;
		seen.add(id);
		const description = localized(
			operation.owner,
			operation.descriptionKey,
			operation.description,
		);
		items.push({
			id,
			label:
				localized(operation.owner, operation.labelKey, operation.label) ??
				operation.label,
			...(description ? { description } : {}),
			kind: "command",
			group: t("tab.groupCommands"),
			...(entry.pinned ? { pinned: true } : {}),
		});
	}
	return items;
}

/** Where a surface opens: its declared default projection, else its overview. */
export function defaultMenuItem(surface: string): string {
	const declared = objectRegistry
		.surface(surface)
		?.menu?.find(
			(entry): entry is Extract<SurfaceMenuItem, { view: string }> =>
				"view" in entry && entry.default === true,
		);
	return declared && objectRegistry.view(declared.view)
		? projectionKey(declared.view)
		: OVERVIEW;
}
