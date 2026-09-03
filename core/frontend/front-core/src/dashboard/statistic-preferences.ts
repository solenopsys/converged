// Which sections are open and which charts the user has hidden. Session
// storage, not the pin service: this is a per-tab view preference, and treating
// it as one keeps the dashboard readable without a backend round trip. Losing
// it on a new session only costs the user a click.

const STORAGE_KEY = "front-core:statistics-dashboard";

export type StatisticPreferences = {
	/** Section owners currently expanded. Everything starts collapsed. */
	expanded: string[];
	/** Type ids the user removed from the dashboard. */
	hidden: string[];
};

const EMPTY: StatisticPreferences = { expanded: [], hidden: [] };

function storage(): Storage | null {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		// Storage access throws outright when the browser blocks it for the origin.
		return null;
	}
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

export function readStatisticPreferences(): StatisticPreferences {
	const raw = storage()?.getItem(STORAGE_KEY);
	if (!raw) return EMPTY;

	try {
		const parsed = JSON.parse(raw) as Partial<StatisticPreferences>;
		return {
			expanded: stringList(parsed.expanded),
			hidden: stringList(parsed.hidden),
		};
	} catch {
		return EMPTY;
	}
}

export function writeStatisticPreferences(
	preferences: StatisticPreferences,
): StatisticPreferences {
	storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences));
	return preferences;
}

function toggle(list: string[], value: string): string[] {
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];
}

export function toggleSection(
	preferences: StatisticPreferences,
	owner: string,
): StatisticPreferences {
	return { ...preferences, expanded: toggle(preferences.expanded, owner) };
}

export function hideWidget(
	preferences: StatisticPreferences,
	typeId: string,
): StatisticPreferences {
	return preferences.hidden.includes(typeId)
		? preferences
		: { ...preferences, hidden: [...preferences.hidden, typeId] };
}

export function restoreWidgets(
	preferences: StatisticPreferences,
	typeIds: readonly string[],
): StatisticPreferences {
	const restored = new Set(typeIds);
	return {
		...preferences,
		hidden: preferences.hidden.filter((typeId) => !restored.has(typeId)),
	};
}
