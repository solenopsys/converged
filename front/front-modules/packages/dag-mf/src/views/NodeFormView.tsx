// model.ts
import { createStore, createEvent, createEffect, combine, sample } from 'effector';
import { useUnit } from 'effector-react';
import dagClient from '../service';

// События
export const hashChanged = createEvent<string>();
export const typeChanged = createEvent<string>();
export const configChanged = createEvent<any>();
export const saveClicked = createEvent();

// Эффекты
export const fetchNodeFx = createEffect(async (hash: string) => {
  const nodeResponse = await dagClient.getNode(hash);
  const nodeConfig = nodeResponse.config;

  const versionsResponse = await dagClient.getCodeSourceVersions(nodeConfig.type || "SQLQueryNode");
  const schemaParams = versionsResponse.versions[0]?.codeHash?.params || [];

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

  return {
    config: {
      name: nodeConfig.name || '',
      description: nodeConfig.description || '',
      type: nodeConfig.type || '',
      params: nodeConfig.params || {},
      inputs: nodeConfig.inputs || {}
    },
    nodeSchema: {
      params: schemaParams,
      inputs: nodeConfig.inputs || [],
      availableTypes
    }
  };
});

export const fetchNodeSchemaFx = createEffect(async (nodeType: string) => {
  const versionsResponse = await dagClient.getCodeSourceVersions(nodeType);
  return versionsResponse.versions[0]?.codeHash?.params || [];
});

export const saveNodeFx = createEffect(async (config: any) => {
  console.log('Configuration saved:', config);
  // await dagClient.updateNode(hash, config);
  return config;
});

// Сторы
export const $config = createStore({
  name: '',
  description: '',
  type: '',
  params: {},
  inputs: {}
});

export const $nodeSchema = createStore({
  params: [],
  inputs: [],
  availableTypes: ['SQLQueryNode', 'APINode', 'TransformNode', 'FilterNode', 'ValidationNode', 'ProcessingNode']
});

export const $loading = createStore(true);

// Комбинированный стор для удобства
export const $nodeFormData = combine({
  config: $config,
  nodeSchema: $nodeSchema,
  loading: $loading
});

// Связи между событиями и сторами
sample({
  clock: hashChanged,
  target: fetchNodeFx
});

sample({
  clock: fetchNodeFx.doneData,
  fn: (data) => data.config,
  target: $config
});

sample({
  clock: fetchNodeFx.doneData,
  fn: (data) => data.nodeSchema,
  target: $nodeSchema
});

sample({
  clock: fetchNodeFx.pending,
  target: $loading
});

sample({
  clock: typeChanged,
  target: fetchNodeSchemaFx
});

sample({
  clock: fetchNodeSchemaFx.doneData,
  source: { config: $config, nodeSchema: $nodeSchema },
  fn: ({ config, nodeSchema }, newParams) => ({
    ...nodeSchema,
    params: newParams
  }),
  target: $nodeSchema
});

sample({
  clock: typeChanged,
  source: $config,
  fn: (config, newType) => ({
    ...config,
    type: newType,
    params: {} // Сбрасываем параметры при смене типа
  }),
  target: $config
});

sample({
  clock: configChanged,
  target: $config
});

sample({
  clock: saveClicked,
  source: $config,
  target: saveNodeFx
});

// Обработка ошибок
fetchNodeFx.failData.watch((error) => {
  console.error("Error fetching workflow:", error);
});

fetchNodeSchemaFx.failData.watch((error) => {
  console.error("Error fetching node schema:", error);
});

saveNodeFx.doneData.watch(() => {
  alert('Configuration saved! Check console for details.');
});

saveNodeFx.failData.watch((error) => {
  console.error('Error saving configuration:', error);
  alert('Error saving configuration. Check console for details.');
});

// Компонент
import React, { useEffect } from 'react';
import DynamicConfigForm from '../components/NodeForm';

export const NodeFormView = ({ hash }: { hash: string }) => {
  const { config, nodeSchema, loading } = useUnit($nodeFormData);
  
  useEffect(() => {
    if (hash) {
      hashChanged(hash);
    }
  }, [hash]);

  const handleTypeChange = (newType: string) => {
    typeChanged(newType);
  };

  const handleSave = () => {
    saveClicked();
  };

  return (
    <DynamicConfigForm
      config={config}
      nodeSchema={nodeSchema}
      loading={loading}
      onConfigChange={configChanged}
      onTypeChange={handleTypeChange}
      onSave={handleSave}
    />
  );
};