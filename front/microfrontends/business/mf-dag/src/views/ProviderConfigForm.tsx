import React, { useEffect } from 'react';
import { createStore, createEvent, createEffect, sample } from 'effector';
import { useUnit } from 'effector-react';
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'front-core';
import { Save, X } from 'lucide-react';
import dagClient from '../service';
import domain, { $providerCodeSources, loadProviderCodeSourcesFx } from '../domain';

// Types
interface SchemaField {
  name: string;
  type: string;
}

interface ProviderConfig {
  name: string;
  codeSource: string;
  config: Record<string, any>;
}

// Events
export const providerFormMounted = domain.createEvent();
export const providerCodeSourceSelected = domain.createEvent<string>();
export const providerNameChanged = domain.createEvent<string>();
export const providerConfigFieldChanged = domain.createEvent<{ field: string; value: any }>();
export const providerSaveClicked = domain.createEvent();
export const providerCancelClicked = domain.createEvent();
export const providerFormReset = domain.createEvent();

// Effects
export const fetchProviderSchemaFx = domain.createEffect<string, SchemaField[]>({
  handler: async (codeSourceName: string) => {
    const result = await dagClient.getCodeSourceVersions(codeSourceName);
    const versions = result.versions || [];
    if (versions.length === 0) return [];
    return versions[0].fields || [];
  }
});

export const createProviderFx = domain.createEffect<ProviderConfig, any>({
  handler: async (data) => {
    const result = await dagClient.createProvider(data.name, data.codeSource, data.config);
    return result;
  }
});

// Stores
export const $providerName = domain.createStore('')
  .on(providerNameChanged, (_, name) => name)
  .reset(providerFormReset);

export const $providerSelectedCodeSource = domain.createStore('')
  .on(providerCodeSourceSelected, (_, cs) => cs)
  .reset(providerFormReset);

export const $providerSchemaFields = domain.createStore<SchemaField[]>([])
  .on(fetchProviderSchemaFx.doneData, (_, fields) => fields)
  .reset(providerFormReset);

export const $providerConfigValues = domain.createStore<Record<string, any>>({})
  .on(providerConfigFieldChanged, (state, { field, value }) => ({ ...state, [field]: value }))
  .reset(providerFormReset)
  .reset(providerCodeSourceSelected);

export const $providerLoading = domain.createStore(false)
  .on(fetchProviderSchemaFx.pending, (_, pending) => pending)
  .on(createProviderFx.pending, (_, pending) => pending);

export const $providerSaving = createProviderFx.pending;

// Load schema when code source selected
sample({
  clock: providerCodeSourceSelected,
  filter: (cs) => cs !== '',
  target: fetchProviderSchemaFx
});

// Load code sources on mount
sample({
  clock: providerFormMounted,
  target: loadProviderCodeSourcesFx
});

// Save handler
sample({
  clock: providerSaveClicked,
  source: { name: $providerName, codeSource: $providerSelectedCodeSource, config: $providerConfigValues },
  filter: ({ name, codeSource }) => name !== '' && codeSource !== '',
  target: createProviderFx
});

// Reset form after successful save
sample({
  clock: createProviderFx.done,
  target: providerFormReset
});

// Component
export const ProviderConfigForm: React.FC<{
  onSave?: () => void;
  onCancel?: () => void;
}> = ({ onSave, onCancel }) => {
  const [
    name,
    selectedCodeSource,
    codeSources,
    schemaFields,
    configValues,
    loading,
    saving
  ] = useUnit([
    $providerName,
    $providerSelectedCodeSource,
    $providerCodeSources,
    $providerSchemaFields,
    $providerConfigValues,
    $providerLoading,
    $providerSaving
  ]);

  useEffect(() => {
    providerFormMounted();
  }, []);

  useEffect(() => {
    const unsub = createProviderFx.done.watch(() => {
      onSave?.();
    });
    return unsub;
  }, [onSave]);

  const handleCancel = () => {
    providerFormReset();
    onCancel?.();
  };

  const renderField = (field: SchemaField) => {
    const value = configValues[field.name] || '';
    const isTextArea = field.type === 'string' && (
      field.name.toLowerCase().includes('query') ||
      field.name.toLowerCase().includes('template') ||
      field.name.toLowerCase().includes('body') ||
      field.name.toLowerCase().includes('connection')
    );

    return (
      <div key={field.name} className="space-y-2">
        <Label>{field.name}</Label>
        {isTextArea ? (
          <Textarea
            value={value}
            onChange={(e) => providerConfigFieldChanged({ field: field.name, value: e.target.value })}
            placeholder={`Enter ${field.name}...`}
            rows={3}
          />
        ) : field.type === 'number' ? (
          <Input
            type="number"
            value={value}
            onChange={(e) => providerConfigFieldChanged({ field: field.name, value: Number(e.target.value) })}
            placeholder={`Enter ${field.name}...`}
          />
        ) : field.type === 'boolean' ? (
          <Select
            value={String(value || false)}
            onValueChange={(v) => providerConfigFieldChanged({ field: field.name, value: v === 'true' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value}
            onChange={(e) => providerConfigFieldChanged({ field: field.name, value: e.target.value })}
            placeholder={`Enter ${field.name}...`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Create Provider</h2>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => providerNameChanged(e.target.value)}
              placeholder="Enter provider name..."
            />
          </div>

          <div className="space-y-2">
            <Label>Code Source *</Label>
            <Select value={selectedCodeSource} onValueChange={providerCodeSourceSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select code source..." />
              </SelectTrigger>
              <SelectContent>
                {codeSources.map((cs) => (
                  <SelectItem key={cs} value={cs}>
                    {cs}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Parameters */}
      {selectedCodeSource && (
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <CardDescription>Configure provider parameters for {selectedCodeSource}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-4">Loading parameters...</div>
            ) : schemaFields.length > 0 ? (
              schemaFields.map(renderField)
            ) : (
              <div className="text-muted-foreground text-center py-4">
                No parameters required
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={() => providerSaveClicked()}
          disabled={!name || !selectedCodeSource || saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default ProviderConfigForm;
