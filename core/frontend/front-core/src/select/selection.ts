import type { FilterInput, SelectionPreset } from "back-core";
import { setRef, type SetRef } from "../object-runtime";
import type { SelectCommand } from "./types";

function mergeFilters(
	current: FilterInput | undefined,
	next: FilterInput | undefined,
): FilterInput | undefined {
	if (!next || Object.keys(next).length === 0) return current;
	if (!current || Object.keys(current).length === 0) return next;
	return { AND: [current, next] };
}

function mergePresets(
	current: readonly SelectionPreset[] | undefined,
	next: readonly SelectionPreset[] | undefined,
): SelectionPreset[] | undefined {
	const merged = [...(current ?? []), ...(next ?? [])];
	if (merged.length === 0) return undefined;
	const byId = new Map<string, SelectionPreset>();
	for (const preset of merged) {
		byId.set(preset.id, preset);
	}
	return [...byId.values()];
}

export function applySelectCommand(
	type: string,
	command: SelectCommand,
	current?: SetRef | null,
): SetRef {
	if (command.scope === "new") {
		if (command.mode !== "replace")
			throw new Error("A new selection must use replace mode");
		return setRef(type, {
			kind: "query",
			...(command.filter ? { filter: command.filter } : {}),
			...(command.presets?.length ? { presets: command.presets } : {}),
		});
	}
	if (!current || current.kind !== "set")
		throw new Error("No active set selection to update");
	if (current.type !== type)
		throw new Error(
			`Active selection has type "${current.type}", expected "${type}"`,
		);
	if (current.selection.kind !== "query")
		throw new Error("An ID selection cannot be refined as a filter query");
	if (command.mode === "refine" && !command.filter)
		if (!command.presets?.length)
			throw new Error("Refine mode requires a filter or preset");
	const presets =
		command.mode === "refine"
			? mergePresets(current.selection.presets, command.presets)
			: command.presets;
	return setRef(type, {
		kind: "query",
		...(command.mode === "refine"
			? (() => {
					const filter = mergeFilters(current.selection.filter, command.filter);
					return filter ? { filter } : {};
				})()
			: command.filter
				? { filter: command.filter }
				: {}),
		...(presets?.length ? { presets } : {}),
	});
}
