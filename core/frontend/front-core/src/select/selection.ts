import type { FilterInput } from "back-core";
import { setRef, type SetRef } from "../object-runtime";
import type { SelectCommand } from "./types";

function mergeFilters(
	current: FilterInput | undefined,
	next: FilterInput,
): FilterInput {
	if (!current || Object.keys(current).length === 0) return next;
	return { AND: [current, next] };
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
		throw new Error("Refine mode requires a filter");
	return setRef(type, {
		kind: "query",
		...(command.mode === "refine"
			? {
					filter: mergeFilters(
						current.selection.filter,
						command.filter as FilterInput,
					),
				}
			: command.filter
				? { filter: command.filter }
				: {}),
	});
}
