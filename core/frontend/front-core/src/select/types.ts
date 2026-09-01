import type {
	FilterInput,
	FilterOperator,
	FilterScalar,
	FilterValueType,
	SelectionPreset,
} from "back-core";
import type { SetRef } from "../object-runtime";

export type SelectionFilterOption = {
	id: FilterScalar;
	label: string;
	aliases?: string[];
};

export type SelectionFilterDefinition = {
	id: string;
	label: string;
	description?: string;
	valueType: FilterValueType;
	operators: readonly FilterOperator[];
	options?: readonly SelectionFilterOption[];
	control?: "text" | "select" | "multi-select" | "boolean" | "date-range";
};

export type SelectionDefinition = {
	filters: readonly SelectionFilterDefinition[];
	presets?: readonly SelectionPresetDefinition[];
};

export type SelectionPresetDefinition = {
	id: string;
	label: string;
	description?: string;
	control?: "tab" | "button" | "menu";
	group?: string;
	parameters?: Record<string, unknown>;
	defaults?: Record<string, unknown>;
};

export type SelectCommand = {
	scope: "new" | "current";
	mode: "replace" | "refine";
	filter?: FilterInput;
	presets?: SelectionPreset[];
};

export type SelectionStats = {
	totalCount: number;
	facets?: Record<string, Record<string, number>>;
};

export type SelectionResult = { selection: SetRef; stats: SelectionStats };
