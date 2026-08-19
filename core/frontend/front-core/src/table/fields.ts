

export interface FieldConfig {
	id: string;
	title: string;
	type: string;
	tableVisible?: boolean;
	cardPrimary?: boolean;
	cardVisible?: boolean;
	cardOrder?: number;
	formVisible?: boolean;
	width?: number;
	minWidth?: number;
	maxWidth?: number;
	sortable?: boolean;
	statusConfig?: Record<
		string,
		{ label: string; variant: string; className?: string }
	>;
	tableRender?: (value: any, rowData: any) => any;
	required?: boolean;
	readonly?: boolean;
	placeholder?: string;
	rows?: number;
	options?: Array<{ value: string | number; label: string }>;
	defaultValue?: any;
	formGroup?: string;
	helpText?: string;
	onChange?: (value: any) => void;
	validation?: {
		pattern?: RegExp;
		min?: number;
		max?: number;
		minLength?: number;
		maxLength?: number;
		message?: string;
		custom?: (value: any) => boolean | string;
	};
}


export const getTableColumns = (fields: FieldConfig[]) =>
	fields
		.filter((field) => field.tableVisible !== false)
		.map((field) => ({
			id: field.id,
			title: field.title,
			type: field.type,
			width: field.width,
			minWidth: field.minWidth,
			maxWidth: field.maxWidth,
			sortable: field.sortable,
			cardPrimary: field.cardPrimary,
			cardVisible: field.cardVisible,
			cardOrder: field.cardOrder,
			statusConfig: field.statusConfig,
			render: field.tableRender,
		}));

export const getFormFields = (fields: FieldConfig[]) =>
	fields.filter((field) => field.formVisible !== false).filter((field) => !field.readonly);

export const getAllFormFields = (fields: FieldConfig[]) =>
	fields.filter((field) => field.formVisible !== false);

export const groupFormFields = (fields: FieldConfig[]) => {
	const grouped: Record<string, FieldConfig[]> = { default: [] };

	fields
		.filter((field) => field.formVisible !== false)
		.forEach((field) => {
			const group = field.formGroup || "default";
			if (!grouped[group]) {
				grouped[group] = [];
			}
			grouped[group].push(field);
		});

	return grouped;
};

export const getDefaultValues = (fields: FieldConfig[]) => {
	const defaults: Record<string, any> = {};

	fields
		.filter((field) => field.formVisible !== false)
		.forEach((field) => {
			if (field.defaultValue !== undefined) {
				defaults[field.id] = field.defaultValue;
			}
		});

	return defaults;
};

export const validateField = (field: FieldConfig, value: any): string | null => {
	// Required check (independent of validation rules)
	if (field.required && (value === undefined || value === null || value === "")) {
		return `${field.title} is required`;
	}

	if (!field.validation) return null;

	const { validation } = field;

	if (validation.pattern && typeof value === "string" && !validation.pattern.test(value)) {
		return validation.message || `Invalid format for ${field.title}`;
	}

	if (typeof value === "number") {
		if (validation.min !== undefined && value < validation.min) {
			return validation.message || `${field.title} must be at least ${validation.min}`;
		}
		if (validation.max !== undefined && value > validation.max) {
			return validation.message || `${field.title} must be at most ${validation.max}`;
		}
	}

	if (typeof value === "string") {
		if (validation.minLength !== undefined && value.length < validation.minLength) {
			return validation.message || `${field.title} must be at least ${validation.minLength} characters`;
		}
		if (validation.maxLength !== undefined && value.length > validation.maxLength) {
			return validation.message || `${field.title} must be at most ${validation.maxLength} characters`;
		}
	}

	if (validation.custom) {
		const result = validation.custom(value);
		if (typeof result === "string") return result;
		if (result === false) return validation.message || `Invalid value for ${field.title}`;
	}

	return null;
};

export const validateFormData = (fields: FieldConfig[], data: Record<string, any>) => {
	const errors: Record<string, string> = {};

	fields
		.filter((field) => field.formVisible !== false && !field.readonly)
		.forEach((field) => {
			const error = validateField(field, data[field.id]);
			if (error) {
				errors[field.id] = error;
			}
		});

	return Object.keys(errors).length > 0 ? errors : null;
};
