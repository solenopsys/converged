import type {
	ISODateString,
	RequestFieldDefinition,
	RequestFieldState,
	RequestFieldType,
	RequestFieldValue,
	RequestFiles,
	RequestFields,
	RequestModel,
	RequestParameterInput,
	RequestProcessType,
	RequestRequirementField,
	RequestRequirementProfile,
	RequestStatus,
} from "../../types";

type BuildRequestModelInput = {
	id: string;
	source?: string;
	status: RequestStatus;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields?: RequestFields;
	parameters?: RequestParameterInput[];
	fieldDefinitions?: RequestFieldDefinition[];
	requirementProfile?: RequestRequirementProfile;
	files?: RequestFiles;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
	previous?: RequestModel;
};

const DEFAULT_GROUP = "request";

function isObject(value: unknown): value is Record<string, any> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFilled(value: RequestFieldValue): boolean {
	if (value === undefined || value === null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	if (isObject(value)) return Object.keys(value).length > 0;
	return true;
}

function humanizeKey(key: string): string {
	return key
		.replace(/^custom[_-]/, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^./, (char) => char.toUpperCase());
}

function inferType(key: string, value: RequestFieldValue): RequestFieldType {
	const normalized = key.toLowerCase();
	if (normalized.includes("material")) return "material";
	if (normalized.includes("tolerance") || normalized.includes("допуск")) {
		return "tolerance";
	}
	if (normalized.includes("surface") || normalized.includes("finish")) {
		return "surface_finish";
	}
	if (normalized.includes("dimension") || normalized.includes("size")) {
		return "dimension";
	}
	if (normalized.includes("date") || normalized.includes("deadline")) {
		return "date";
	}
	if (normalized.includes("file")) return "file";
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "boolean";
	if (Array.isArray(value)) return "multiselect";
	if (isObject(value)) return "json";
	return "text";
}

function normalizeDefinition(
	definition: RequestFieldDefinition,
): RequestFieldDefinition | null {
	const key = definition.key?.trim();
	if (!key) return null;
	return {
		...definition,
		key,
		label: definition.label?.trim() || humanizeKey(key),
		type: definition.type || "text",
		group: definition.group?.trim() || DEFAULT_GROUP,
		order: Number.isFinite(definition.order) ? definition.order : 1000,
	};
}

function normalizeRequirementField(
	field: RequestRequirementField,
): RequestFieldDefinition | null {
	const normalized = normalizeDefinition(field);
	if (!normalized) return null;
	return {
		...normalized,
		source: normalized.source ?? "requirements:profile",
	};
}

function normalizeAlias(value: string): string {
	return value
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/[^a-zа-я0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/[^a-zа-я0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function profileAliasScore(
	profile: RequestRequirementProfile,
	searchText: string,
): number {
	const candidates = [
		profile.processType,
		profile.title,
		...(profile.aliases ?? []),
	]
		.map((value) => normalizeSearchText(value ?? ""))
		.filter(Boolean);

	let score = 0;
	for (const candidate of candidates) {
		if (candidate.length > 0 && searchText.includes(candidate)) {
			score += candidate.length;
		}
	}
	return score;
}

function createFieldAliasMap(
	profile?: RequestRequirementProfile,
): Map<string, string> {
	const aliases = new Map<string, string>();
	for (const field of profile?.fields ?? []) {
		const key = field.key?.trim();
		if (!key) continue;
		aliases.set(normalizeAlias(key), key);
		for (const alias of field.aliases ?? []) {
			aliases.set(normalizeAlias(alias), key);
		}
	}
	return aliases;
}

function normalizeFieldKeys(
	fields: RequestFields | undefined,
	profile?: RequestRequirementProfile,
): RequestFields {
	if (!fields) return {};
	const aliases = createFieldAliasMap(profile);
	return Object.fromEntries(
		Object.entries(fields).map(([key, value]) => {
			const canonical = aliases.get(normalizeAlias(key)) ?? key;
			return [canonical, value];
		}),
	);
}

function definitionFromParameter(
	parameter: RequestParameterInput,
): RequestFieldDefinition | null {
	const key = parameter.key?.trim();
	if (!key) return null;
	return normalizeDefinition({
		key,
		label: parameter.label || humanizeKey(key),
		type: parameter.type || inferType(key, parameter.value),
		required: parameter.required,
		group: parameter.group,
		unit: parameter.unit,
		description: parameter.description,
		options: parameter.options,
		order: parameter.order,
		source: parameter.source,
	});
}

export function inferRequestProcessType(
	input: Pick<
		BuildRequestModelInput,
		| "source"
		| "processType"
		| "fields"
		| "previous"
		| "title"
		| "summary"
	>,
	profiles: RequestRequirementProfile[] = [],
): RequestProcessType {
	if (input.processType) return input.processType;
	if (input.previous?.processType) return input.previous.processType;

	const source = input.source ?? "";
	const operation = String(input.fields?.operation ?? "");
	const fieldsText = Object.values(input.fields ?? {})
		.map((value) =>
			typeof value === "string" || typeof value === "number"
				? String(value)
				: "",
		)
		.join(" ");
	const text = normalizeSearchText(
		`${source} ${operation} ${input.title ?? ""} ${input.summary ?? ""} ${fieldsText}`,
	);
	const bestProfile = profiles
		.filter((profile) => profile.processType !== "generic")
		.map((profile) => ({
			profile,
			score: profileAliasScore(profile, text),
		}))
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score)[0]?.profile;

	if (bestProfile) return bestProfile.processType;
	return "generic";
}

export function buildRequestModel(input: BuildRequestModelInput): RequestModel {
	const now = input.updatedAt ?? new Date().toISOString();
	const processType = inferRequestProcessType(input);
	const requirementProfile =
		input.requirementProfile?.processType === processType
			? input.requirementProfile
			: undefined;
	const files = {
		...(input.previous?.files ?? {}),
		...(input.files ?? {}),
	};
	const rawFields: RequestFields = {
		...snapshotFields(input.previous),
		...normalizeFieldKeys(input.fields, requirementProfile),
	};

	const definitions = new Map<string, RequestFieldDefinition>();
	const requirementFields = new Map<string, RequestRequirementField>();
	const requirementFieldKeys = new Set(
		(requirementProfile?.fields ?? []).map((field) => field.key),
	);
	const processTypeChanged = Boolean(
		input.previous && input.previous.processType !== processType,
	);
	const addDefinition = (definition: RequestFieldDefinition | null) => {
		if (!definition) return;
		const previous = definitions.get(definition.key);
		definitions.set(definition.key, {
			...previous,
			...definition,
			required: definition.required ?? previous?.required,
		});
	};

	for (const field of requirementProfile?.fields ?? []) {
		if (field.key) requirementFields.set(field.key, field);
		addDefinition(normalizeRequirementField(field));
	}
	for (const state of Object.values(input.previous?.fields ?? {})) {
		if (
			requirementProfile &&
			!requirementFieldKeys.has(state.key) &&
			!isFilled(state.value) &&
			rawFields[state.key] === undefined &&
			state.source !== "custom"
		) {
			continue;
		}
		if (processTypeChanged) {
			if (requirementFieldKeys.has(state.key)) continue;
			addDefinition(
				normalizeDefinition({
					...state,
					required: false,
					source: state.source ?? "previous-profile",
				}),
			);
			continue;
		}
		addDefinition(normalizeDefinition(state));
	}
	for (const definition of input.fieldDefinitions ?? []) {
		addDefinition(
			normalizeDefinition({
				...definition,
				source: definition.source ?? "custom",
			}),
		);
	}
	for (const [key, value] of Object.entries(rawFields)) {
		if (!definitions.has(key)) {
			addDefinition(
				normalizeDefinition({
					key,
					label: humanizeKey(key),
					type: inferType(key, value),
					group: DEFAULT_GROUP,
					order: 900,
				}),
			);
		}
	}
	for (const parameter of input.parameters ?? []) {
		const definition = definitionFromParameter(parameter);
		addDefinition(definition);
		if (definition) rawFields[definition.key] = parameter.value;
	}

	const fields: Record<string, RequestFieldState> = {};
	for (const definition of definitions.values()) {
		const previous = input.previous?.fields?.[definition.key];
		const value =
			rawFields[definition.key] !== undefined
				? rawFields[definition.key]
				: previous?.value;
		const parameter = input.parameters?.find(
			(item) => item.key === definition.key,
		);
		const filled = isFilled(value);
		fields[definition.key] = {
			...definition,
			value,
			status:
				filled && parameter?.confidence !== undefined && parameter.confidence < 0.6
					? "needs_review"
					: filled
						? "filled"
						: "missing",
			confidence: parameter?.confidence ?? previous?.confidence,
			updatedAt:
				rawFields[definition.key] !== undefined || parameter
					? now
					: previous?.updatedAt,
		};
	}

	const ordered = Object.values(fields).sort((a, b) => {
		const byOrder = (a.order ?? 1000) - (b.order ?? 1000);
		if (byOrder !== 0) return byOrder;
		return a.label.localeCompare(b.label);
	});
	const fieldOrder = ordered.map((field) => field.key);
	const missingRequired = ordered
		.filter((field) => field.required && !isFilled(field.value))
		.map((field) => field.key);
	const remainingDelta = ordered
		.filter((field) => field.required && !isFilled(field.value))
		.map((field) => {
			const requirement = requirementFields.get(field.key);
			return {
				key: field.key,
				label: field.label,
				type: field.type,
				required: field.required,
				group: field.group,
				unit: field.unit,
				description: field.description,
				options: field.options,
				order: field.order,
				source: field.source,
				aliases: requirement?.aliases,
				ask: requirement?.ask,
				extractionHints: requirement?.extractionHints,
			};
		});
	const required = ordered.filter((field) => field.required).length;
	const filledRequired = ordered.filter(
		(field) => field.required && isFilled(field.value),
	).length;
	const filledTotal = ordered.filter((field) => isFilled(field.value)).length;
	const percent =
		required > 0
			? Math.round((filledRequired / required) * 100)
			: ordered.length > 0
				? Math.round((filledTotal / ordered.length) * 100)
				: 0;

	return {
		id: input.id,
		source: input.source || input.previous?.source,
		status: input.status,
		processType,
		title:
			input.title ??
			input.previous?.title ??
			requirementProfile?.title ??
			defaultTitle(processType),
		summary: input.summary ?? input.previous?.summary,
		fields,
		fieldOrder,
		files,
		missingRequired,
		remainingRequired: missingRequired,
		remainingDelta,
		completion: {
			required,
			filledRequired,
			total: ordered.length,
			filledTotal,
			percent,
		},
		createdAt: input.createdAt,
		updatedAt: now,
		revision: (input.previous?.revision ?? 0) + 1,
	};
}

export function snapshotFields(model?: RequestModel): RequestFields {
	if (!model) return {};
	return Object.fromEntries(
		Object.entries(model.fields)
			.filter(([, field]) => field.value !== undefined)
			.map(([key, field]) => [key, field.value]),
	);
}

function defaultTitle(processType: RequestProcessType): string {
	switch (processType) {
		case "cnc_machining":
			return "Заявка на ЧПУ обработку";
		case "laser_cutting":
		case "plastic_cutting":
			return "Заявка на резку материала";
		case "3d_printing":
			return "Заявка на 3D печать";
		default:
			return "Производственная заявка";
	}
}
