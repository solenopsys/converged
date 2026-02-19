/**
 * Utilities for working with unified field configurations
 * Used to extract table columns and form fields from a single source
 */

export interface FieldConfig {
  id: string;
  title: string;
  type: string;
  tableVisible?: boolean;
  formVisible?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  statusConfig?: Record<string, { label: string; variant: string; className?: string }>;
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

/**
 * Extract table column configuration from unified fields
 */
export const getTableColumns = (fields: FieldConfig[]) => {
  return fields
    .filter(field => field.tableVisible !== false)
    .map(field => ({
      id: field.id,
      title: field.title,
      type: field.type,
      width: field.width,
      minWidth: field.minWidth,
      maxWidth: field.maxWidth,
      sortable: field.sortable,
      statusConfig: field.statusConfig,
      render: field.tableRender
    }));
};

/**
 * Extract form field configuration from unified fields
 */
export const getFormFields = (fields: FieldConfig[]) => {
  return fields
    .filter(field => field.formVisible !== false)
    .filter(field => !field.readonly);
};

/**
 * Get all form fields including readonly (for display)
 */
export const getAllFormFields = (fields: FieldConfig[]) => {
  return fields.filter(field => field.formVisible !== false);
};

/**
 * Group form fields by formGroup property
 */
export const groupFormFields = (fields: FieldConfig[]) => {
  const grouped: Record<string, FieldConfig[]> = {
    default: []
  };

  fields
    .filter(field => field.formVisible !== false)
    .forEach(field => {
      const group = field.formGroup || 'default';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(field);
    });

  return grouped;
};

/**
 * Get default values for form initialization
 */
export const getDefaultValues = (fields: FieldConfig[]) => {
  const defaults: Record<string, any> = {};

  fields
    .filter(field => field.formVisible !== false)
    .forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.id] = field.defaultValue;
      }
    });

  return defaults;
};

/**
 * Validate field value based on field configuration
 */
export const validateField = (field: FieldConfig, value: any): string | null => {
  // Required check (independent of validation rules)
  if (field.required && (value === undefined || value === null || value === '')) {
    return `${field.title} is required`;
  }

  if (!field.validation) return null;

  const { validation } = field;

  // Pattern validation
  if (validation.pattern && typeof value === 'string' && !validation.pattern.test(value)) {
    return validation.message || `Invalid format for ${field.title}`;
  }

  // Min/Max for numbers
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      return validation.message || `${field.title} must be at least ${validation.min}`;
    }
    if (validation.max !== undefined && value > validation.max) {
      return validation.message || `${field.title} must be at most ${validation.max}`;
    }
  }

  // MinLength/MaxLength for strings
  if (typeof value === 'string') {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      return validation.message || `${field.title} must be at least ${validation.minLength} characters`;
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      return validation.message || `${field.title} must be at most ${validation.maxLength} characters`;
    }
  }

  // Custom validation
  if (validation.custom) {
    const result = validation.custom(value);
    if (typeof result === 'string') return result;
    if (result === false) return validation.message || `Invalid value for ${field.title}`;
  }

  return null;
};

/**
 * Validate entire form data
 */
export const validateFormData = (fields: FieldConfig[], data: Record<string, any>) => {
  const errors: Record<string, string> = {};

  fields
    .filter(field => field.formVisible !== false && !field.readonly)
    .forEach(field => {
      const error = validateField(field, data[field.id]);
      if (error) {
        errors[field.id] = error;
      }
    });

  return Object.keys(errors).length > 0 ? errors : null;
};
