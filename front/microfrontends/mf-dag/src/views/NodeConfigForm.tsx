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
import domain, { $codeSources, loadCodeSourcesFx } from '../domain';

// Types
interface SchemaField {
  name: string;
  type: string;
}

interface NodeConfig {
  name: string;
  codeSource: string;
  config: Record<string, any>;
}

// Events
export const formMounted = domain.createEvent();
export const codeSourceSelected = domain.createEvent<string>();
export const nameChanged = domain.createEvent<string>();
export const configFieldChanged = domain.createEvent<{ field: string; value: any }>();
export const saveClicked = domain.createEvent();
export const cancelClicked = domain.createEvent();
export const formReset = domain.createEvent();

// Effects
export const fetchSchemaFx = domain.createEffect<string, SchemaField[]>({
  handler: async (codeSourceName: string) => {
    const result = await dagClient.getCodeSourceVersions(codeSourceName);
    const versions = result.versions || [];
    if (versions.length === 0) return [];
    // Get fields from latest version
    return versions[0].fields || [];
  }
});

export const createNodeFx = domain.createEffect<NodeConfig, any>({
  handler: async (data) => {
    // First create node config
    const configResult = await dagClient.createNodeConfig(data.codeSource, data.config);
    // Then create node with that config
    const nodeResult = await dagClient.createNode(data.name, configResult.hash);
    return nodeResult;
  }
});

// Stores
export const $name = domain.createStore('')
  .on(nameChanged, (_, name) => name)
  .reset(formReset);

export const $selectedCodeSource = domain.createStore('')
  .on(codeSourceSelected, (_, cs) => cs)
  .reset(formReset);

export const $schemaFields = domain.createStore<SchemaField[]>([])
  .on(fetchSchemaFx.doneData, (_, fields) => fields)
  .reset(formReset);

export const $configValues = domain.createStore<Record<string, any>>({})
  .on(configFieldChanged, (state, { field, value }) => ({ ...state, [field]: value }))
  .reset(formReset)
  .reset(codeSourceSelected); // Reset config when code source changes

export const $loading = domain.createStore(false)
  .on(fetchSchemaFx.pending, (_, pending) => pending)
  .on(createNodeFx.pending, (_, pending) => pending);

export const $saving = createNodeFx.pending;

// Load schema when code source selected
sample({
  clock: codeSourceSelected,
  filter: (cs) => cs !== '',
  target: fetchSchemaFx
});

// Load code sources on mount
sample({
  clock: formMounted,
  target: loadCodeSourcesFx
});

// Save handler
sample({
  clock: saveClicked,
  source: { name: $name, codeSource: $selectedCodeSource, config: $configValues },
  filter: ({ name, codeSource }) => name !== '' && codeSource !== '',
  target: createNodeFx
});

// Reset form after successful save
sample({
  clock: createNodeFx.done,
  target: formReset
});

// Component
export const NodeConfigForm: React.FC<{
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
    $name,
    $selectedCodeSource,
    $codeSources,
    $schemaFields,
    $configValues,
    $loading,
    $saving
  ]);

  useEffect(() => {
    formMounted();
  }, []);

  // Subscribe to save success
  useEffect(() => {
    const unsub = createNodeFx.done.watch(() => {
      onSave?.();
    });
    return unsub;
  }, [onSave]);

  const handleCancel = () => {
    formReset();
    onCancel?.();
  };

  const renderField = (field: SchemaField) => {
    const value = configValues[field.name] || '';
    const isTextArea = field.type === 'string' && (
      field.name.toLowerCase().includes('query') ||
      field.name.toLowerCase().includes('template') ||
      field.name.toLowerCase().includes('body')
    );

    return (
      <div key={field.name} className="space-y-2">
        <Label>{field.name}</Label>
        {isTextArea ? (
          <Textarea
            value={value}
            onChange={(e) => configFieldChanged({ field: field.name, value: e.target.value })}
            placeholder={`Enter ${field.name}...`}
            rows={3}
          />
        ) : field.type === 'number' ? (
          <Input
            type="number"
            value={value}
            onChange={(e) => configFieldChanged({ field: field.name, value: Number(e.target.value) })}
            placeholder={`Enter ${field.name}...`}
          />
        ) : field.type === 'boolean' ? (
          <Select
            value={String(value || false)}
            onValueChange={(v) => configFieldChanged({ field: field.name, value: v === 'true' })}
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
            onChange={(e) => configFieldChanged({ field: field.name, value: e.target.value })}
            placeholder={`Enter ${field.name}...`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Create Node</h2>
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
              onChange={(e) => nameChanged(e.target.value)}
              placeholder="Enter node name..."
            />
          </div>

          <div className="space-y-2">
            <Label>Code Source *</Label>
            <Select value={selectedCodeSource} onValueChange={codeSourceSelected}>
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
            <CardDescription>Configure node parameters for {selectedCodeSource}</CardDescription>
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
          onClick={() => saveClicked()}
          disabled={!name || !selectedCodeSource || saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default NodeConfigForm;
