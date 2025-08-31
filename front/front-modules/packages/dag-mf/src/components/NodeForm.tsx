import React, { useEffect, useState } from 'react';
import { Button } from 'converged-core';
import { Input } from 'converged-core';
import { Label } from 'converged-core';
import { Textarea } from 'converged-core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'converged-core';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'converged-core';
import { Trash2, Plus, Save } from 'lucide-react';
import dagClient from '../service';

const DynamicConfigForm = ({ hash }: { hash: string }) => {
  const [config, setConfig] = useState({
    name: '',
    description: '',
    type: '',
    params: {},
    inputs: {}
  });

  const [nodeSchema, setNodeSchema] = useState({
    params: [],
    inputs: [],
    availableTypes: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        
        // Получаем конфигурацию существующего узла
        const nodeResponse = await dagClient.getNode(hash);
        const nodeConfig = nodeResponse.config;

        // Получаем схему параметров для данного типа узла
        const versionsResponse = await dagClient.getCodeSourceVersions(nodeConfig.type || "SQLQueryNode");
        const schemaParams = versionsResponse.versions[0]?.codeHash?.params || [];

        // Получаем доступные типы узлов (можно расширить логику получения)
        const availableTypes = [
          'SQLQueryNode',
          'APINode', 
          'TransformNode',
          'FilterNode',
          'ValidationNode',
          'ProcessingNode'
        ];

        console.log("nodeConfig", nodeConfig);
        console.log("schemaParams", schemaParams);

        // Устанавливаем схему
        setNodeSchema({
          params: schemaParams,
          inputs: nodeConfig.inputs || [],
          availableTypes
        });

        // Устанавливаем конфигурацию
        setConfig({
          name: nodeConfig.name || '',
          description: nodeConfig.description || '',
          type: nodeConfig.type || '',
          params: nodeConfig.params || {},
          inputs: nodeConfig.inputs || {}
        });

      } catch (error) {
        console.error("Error fetching workflow:", error);
        // Устанавливаем дефолтные значения при ошибке
        setNodeSchema({
          params: [],
          inputs: [],
          availableTypes: ['SQLQueryNode', 'APINode', 'TransformNode', 'FilterNode', 'ValidationNode', 'ProcessingNode']
        });
      } finally {
        setLoading(false);
      }
    };

    if (hash) {
      fetchWorkflow();
    }
  }, [hash]);

  // Обновляем схему параметров при изменении типа узла
  const handleTypeChange = async (newType) => {
    try {
      const versionsResponse = await dagClient.getCodeSourceVersions(newType);
      const schemaParams = versionsResponse.versions[0]?.codeHash?.params || [];
      
      setNodeSchema(prev => ({
        ...prev,
        params: schemaParams
      }));

      // Обновляем конфигурацию с новым типом и сбрасываем параметры
      setConfig(prev => ({
        ...prev,
        type: newType,
        params: {} // Сбрасываем параметры при смене типа
      }));
    } catch (error) {
      console.error("Error fetching node schema:", error);
      // Просто обновляем тип без смены схемы
      setConfig(prev => ({
        ...prev,
        type: newType
      }));
    }
  };

  const handleBasicFieldChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParamChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      params: {
        ...prev.params,
        [key]: value
      }
    }));
  };

  const handleInputChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      inputs: {
        ...prev.inputs,
        [key]: value
      }
    }));
  };

  const addInput = () => {
    const newKey = `input_${Object.keys(config.inputs).length + 1}`;
    handleInputChange(newKey, '');
  };

  const removeInput = (key) => {
    setConfig(prev => {
      const newInputs = { ...prev.inputs };
      delete newInputs[key];
      return {
        ...prev,
        inputs: newInputs
      };
    });
  };

  const handleInputKeyChange = (oldKey, newKey) => {
    if (oldKey === newKey) return;

    setConfig(prev => {
      const newInputs = { ...prev.inputs };
      newInputs[newKey] = newInputs[oldKey];
      delete newInputs[oldKey];
      return {
        ...prev,
        inputs: newInputs
      };
    });
  };

  const handleSave = async () => {
    try {
      console.log('Configuration saved:', config);
      // Здесь отправляем конфигурацию на бэкенд
      // await dagClient.updateNode(hash, config);
      alert('Configuration saved! Check console for details.');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration. Check console for details.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold mb-2 shrink-0">Параметры узла</h2>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure the basic properties of your node</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => handleBasicFieldChange('name', e.target.value)}
                placeholder="Enter node name"
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={config.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select node type" />
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={config.description}
              onChange={(e) => handleBasicFieldChange('description', e.target.value)}
              placeholder="Enter node description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parameters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Parameters</CardTitle>
              <CardDescription>Configure node-specific parameters based on schema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nodeSchema.params.map((paramSchema) => (
            <div key={paramSchema.name}>
              <Label htmlFor={paramSchema.name}>
                {paramSchema.name} 
                {paramSchema.type && <span className="text-sm text-muted-foreground ml-1">({paramSchema.type})</span>}
              </Label>
              {paramSchema.type === 'textarea' || paramSchema.name.toLowerCase().includes('query') ? (
                <Textarea
                  id={paramSchema.name}
                  value={config.params[paramSchema.name] || ''}
                  onChange={(e) => handleParamChange(paramSchema.name, e.target.value)}
                  placeholder={`Enter ${paramSchema.name}`}
                  rows={4}
                />
              ) : (
                <Input
                  id={paramSchema.name}
                  value={config.params[paramSchema.name] || ''}
                  onChange={(e) => handleParamChange(paramSchema.name, e.target.value)}
                  placeholder={`Enter ${paramSchema.name}`}
                />
              )}
            </div>
          ))}
          
          {/* Показываем дополнительные параметры, которых нет в схеме */}
          {Object.entries(config.params).map(([key, value]) => {
            const isInSchema = nodeSchema.params.some(p => p.name === key);
            if (isInSchema) return null;
            
            return (
              <div key={key}>
                <Label htmlFor={key}>{key} <span className="text-sm text-muted-foreground">(custom)</span></Label>
                <Input
                  id={key}
                  value={value}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                  placeholder={`Enter ${key}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Inputs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Define input mappings (key-value pairs)</CardDescription>
            </div>
            <Button onClick={addInput} size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Input
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(config.inputs).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={key}
                  onChange={(e) => handleInputKeyChange(key, e.target.value)}
                  placeholder="Input key"
                />
              </div>
              <span className="text-muted-foreground">:</span>
              <div className="flex-1">
                <Input
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder="$.context.path.to.value"
                />
              </div>
              <Button
                onClick={() => removeInput(key)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Config
        </Button>
      </div>
    </div>
  );
};

export default DynamicConfigForm;