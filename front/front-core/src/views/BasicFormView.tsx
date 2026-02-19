import React, { useState, useEffect } from 'react';
import { useUnit } from 'effector-react';
import { Store } from 'effector';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { FieldConfig, validateFormData } from '../utils/fields';

const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  EMAIL: 'email',
  PASSWORD: 'password',
  DATE: 'date',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  TEXTAREA: 'textarea',
  TAGS: 'tags',
  CUSTOM: 'custom'
} as const;

interface BasicFormViewProps {
  fields: FieldConfig[];
  entityStore?: Store<any>;
  title?: string;
  subtitle?: string;
  onSave?: (data: any) => void | Promise<void>;
  onCancel?: () => void;
  saveButtonText?: string;
  cancelButtonText?: string;
  loading?: boolean;
}

/**
 * Universal form component that renders based on field configuration
 * Used for creating/editing entities in sidebar panels
 */
export const BasicFormView: React.FC<BasicFormViewProps> = ({
  fields,
  entityStore,
  title = 'Form',
  subtitle,
  onSave,
  onCancel,
  saveButtonText = 'Save',
  cancelButtonText = 'Cancel',
  loading = false
}) => {
  const entity = entityStore ? useUnit(entityStore) : null;

  // Initialize form data from entity or default values
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    fields.forEach(field => {
      let val: any;
      if (entity && entity[field.id] !== undefined) {
        val = entity[field.id];
      } else if (field.defaultValue !== undefined) {
        val = field.defaultValue;
      } else {
        val = '';
      }
      if (field.type === FIELD_TYPES.TEXTAREA && val !== null && typeof val === 'object') {
        val = JSON.stringify(val, null, 2);
      }
      initial[field.id] = val;
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when entity changes
  useEffect(() => {
    if (entity) {
      const updated: Record<string, any> = {};
      fields.forEach(field => {
        let val = entity[field.id] ?? field.defaultValue ?? '';
        if (field.type === FIELD_TYPES.TEXTAREA && val !== null && typeof val === 'object') {
          val = JSON.stringify(val, null, 2);
        }
        updated[field.id] = val;
      });
      setFormData(updated);
    }
  }, [entity, fields]);

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setTouched(prev => ({ ...prev, [fieldId]: true }));
    const field = fields.find(f => f.id === fieldId);
    field?.onChange?.(value);

    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    fields.forEach(field => {
      if (field.formVisible !== false && !field.readonly) {
        allTouched[field.id] = true;
      }
    });
    setTouched(allTouched);

    // Validate
    const validationErrors = validateFormData(fields, formData);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave?.(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.id] ?? '';
    const error = touched[field.id] ? errors[field.id] : undefined;
    const isInvalid = !!error;

    // Skip fields not visible in form
    if (field.formVisible === false) return null;

    // Readonly display
    if (field.readonly) {
      return (
        <div key={field.id} className="space-y-2">
          <Label className="text-sm font-medium">{field.title}</Label>
          <div className="text-sm text-muted-foreground">
            {field.type === FIELD_TYPES.DATE || field.type === FIELD_TYPES.DATETIME
              ? value ? new Date(value).toLocaleString() : '-'
              : value || '-'}
          </div>
        </div>
      );
    }

    const commonProps = {
      id: field.id,
      'aria-invalid': isInvalid,
      disabled: isSubmitting || loading
    };

    switch (field.type) {
      case FIELD_TYPES.TEXT:
      case FIELD_TYPES.EMAIL:
      case FIELD_TYPES.PASSWORD:
      case FIELD_TYPES.NUMBER:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.title}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type={field.type === FIELD_TYPES.NUMBER ? 'number' : field.type}
              value={value}
              onChange={(e) => handleChange(field.id, field.type === FIELD_TYPES.NUMBER ? Number(e.target.value) : e.target.value)}
              placeholder={field.placeholder}
            />
            {field.helpText && !error && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        );

      case FIELD_TYPES.TEXTAREA:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.title}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              {...commonProps}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 3}
            />
            {field.helpText && !error && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        );

      case FIELD_TYPES.SELECT:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.title}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={String(value)}
              onValueChange={(val) => handleChange(field.id, val)}
              disabled={commonProps.disabled}
            >
              <SelectTrigger aria-invalid={isInvalid}>
                <SelectValue placeholder={field.placeholder || `Select ${field.title}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.helpText && !error && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        );

      case FIELD_TYPES.DATE:
      case FIELD_TYPES.DATETIME:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.title}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type={field.type === FIELD_TYPES.DATETIME ? 'datetime-local' : 'date'}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
            />
            {field.helpText && !error && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        );

      case FIELD_TYPES.BOOLEAN:
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              {...commonProps}
              checked={!!value}
              onCheckedChange={(checked) => handleChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="cursor-pointer">
              {field.title}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {error && (
              <p className="text-xs text-destructive ml-2">{error}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.id} className="text-sm text-muted-foreground">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
        <div className="px-6 py-4 space-y-4">
          {fields.map(renderField)}
        </div>
      </form>

      {/* Footer */}
      <div className="border-t px-6 py-4">
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || loading}
            >
              {cancelButtonText}
            </Button>
          )}
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? 'Saving...' : saveButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
};
