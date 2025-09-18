import React from 'react';
import { Button } from 'converged-core';
import { Input } from 'converged-core';
import { Label } from 'converged-core';
import { Textarea } from 'converged-core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'converged-core';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'converged-core';
import { Trash2, Plus, Save } from 'lucide-react';

interface ConfigType {
  name: string;
  description: string;
  type: string;
  params: Record<string, any>;
  inputs: Record<string, any>;
}

interface NodeSchemaType {
  params: Array<{ name: string; type?: string }>;
  inputs: any[];
  availableTypes: string[];
}

// Простая строка ключ-значение
interface KeyValueRowProps {
  itemKey: string;
  value: string;
  onKeyChange: (newKey: string) => void;
  onValueChange: (newValue: string) => void;
  onRemove: () => void;
  readonly?: boolean;
  useTextarea?: boolean;
  label?: string;
}

const KeyValueRow: React.FC<KeyValueRowProps> = ({
  itemKey,
  value,
  onKeyChange,
  onValueChange,
  onRemove,
  readonly = false,
  useTextarea = false,
  label
}) => (
  <div className="space-y-2">
    {label && <Label>{label}</Label>}
    <div className="flex gap-2">
      {!readonly && (
        <Input
          value={itemKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="Key"
          className="flex-1"
        />
      )}
      {useTextarea ? (
        <Textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Value"
          rows={3}
          className="flex-1"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Value"
          className="flex-1"
        />
      )}
      <Button onClick={onRemove} variant="outline" size="sm">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

// Список ключ-значение пар
interface KeyValueListProps {
  title: string;
  description: string;
  items: Record<string, string>;
  onChange: (items: Record<string, string>) => void;
  schema?: Array<{ name: string; type?: string }>;
}

const KeyValueList: React.FC<KeyValueListProps> = ({
  title,
  description,
  items,
  onChange,
  schema = []
}) => {
  const updateItem = (oldKey: string, newKey: string, value: string) => {
    const newItems = { ...items };
    if (oldKey !== newKey) {
      delete newItems[oldKey];
    }
    newItems[newKey] = value;
    onChange(newItems);
  };

  const removeItem = (key: string) => {
    const newItems = { ...items };
    delete newItems[key];
    onChange(newItems);
  };

  const addItem = () => {
    const newKey = `item_${Date.now()}`;
    onChange({ ...items, [newKey]: '' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button onClick={addItem} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Schema fields */}
        {schema.map((field) => (
          <KeyValueRow
            key={field.name}
            itemKey={field.name}
            value={items[field.name] || ''}
            onKeyChange={() => {}} // readonly
            onValueChange={(value) => updateItem(field.name, field.name, value)}
            onRemove={() => removeItem(field.name)}
            readonly
            useTextarea={field.type === 'textarea' || field.name.includes('query')}
            label={field.name}
          />
        ))}
        
        {/* Custom fields */}
        {Object.entries(items)
          .filter(([key]) => !schema.some(s => s.name === key))
          .map(([key, value]) => (
            <KeyValueRow
              key={key}
              itemKey={key}
              value={value}
              onKeyChange={(newKey) => updateItem(key, newKey, value)}
              onValueChange={(newValue) => updateItem(key, key, newValue)}
              onRemove={() => removeItem(key)}
            />
          ))}
      </CardContent>
    </Card>
  );
};

interface DynamicConfigFormProps {
  config: ConfigType;
  nodeSchema: NodeSchemaType;
  loading: boolean;
  onConfigChange: (config: ConfigType) => void;
  onTypeChange: (newType: string) => void;
  onSave: () => void;
}

const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
  config,
  nodeSchema,
  loading,
  onConfigChange,
  onTypeChange,
  onSave
}) => {
  const updateConfig = (field: keyof ConfigType, value: any) => {
    onConfigChange({ ...config, [field]: value });
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto p-4 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h2 className="text-lg font-semibold">Параметры узла</h2>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={config.name}
                onChange={(e) => updateConfig('name', e.target.value)}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={config.type} onValueChange={onTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nodeSchema.availableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={config.description}
              onChange={(e) => updateConfig('description', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parameters */}
      <KeyValueList
        title="Parameters"
        description="Configure node parameters"
        items={config.params}
        onChange={(params) => updateConfig('params', params)}
        schema={nodeSchema.params}
      />

      {/* Inputs */}
      <KeyValueList
        title="Inputs"
        description="Define input mappings"
        items={config.inputs}
        onChange={(inputs) => updateConfig('inputs', inputs)}
      />

      <Button onClick={onSave}>
        <Save className="w-4 h-4 mr-2" />
        Save Config
      </Button>
    </div>
  );
};

export default DynamicConfigForm;