import { createStore, createEvent, createEffect, sample } from 'effector';
import dagClient from '../service';

// Types
interface WorkflowConfig {
  nodes: Record<string, string>;
  links: Record<string, string>;
}

// Events
export const setPanelCollapsed = createEvent<boolean>();
export const setActiveNode = createEvent<string | null>();
export const setWorkflowName = createEvent<string>();
export const nodeClicked = createEvent<string>();
export const addCompletedNode = createEvent<string>();
export const removeCompletedNode = createEvent<string>();
export const resetWorkflow = createEvent();

// Effects
export const fetchWorkflowFx = createEffect<string, WorkflowConfig | null>(
  async (workflowName: string) => {
    try {
      const versions = await (await dagClient.getWorkflowVersions(workflowName)).versions;
      const config: WorkflowConfig = 
        await dagClient.getWorkflowConfigByName(workflowName, versions[versions.length - 1]);
      
      console.log("CONFIG", config);
      return config;
    } catch (error) {
      console.error("Error fetching workflow:", error);
      return null;
    }
  }
);

// Stores
export const $workflowName = createStore<string | null>(null)
  .on(setWorkflowName, (_, name) => name)
  .reset(resetWorkflow);

export const $isPanelCollapsed = createStore(false)
  .on(setPanelCollapsed, (_, collapsed) => collapsed);

export const $workflowConfig = createStore<WorkflowConfig | null>(null)
  .on(fetchWorkflowFx.doneData, (_, config) => config)
  .reset([fetchWorkflowFx.fail, resetWorkflow]);

export const $completedNodes = createStore<Set<string>>(new Set())
  .on(addCompletedNode, (nodes, nodeName) => new Set([...nodes, nodeName]))
  .on(removeCompletedNode, (nodes, nodeName) => {
    const newNodes = new Set(nodes);
    newNodes.delete(nodeName);
    return newNodes;
  })
  .reset(resetWorkflow);

export const $activeNodeName = createStore<string | null>(null)
  .on(setActiveNode, (_, nodeName) => nodeName)
  .reset(resetWorkflow);

export const $activeNodeHash = $workflowConfig.map(
  (config, activeNodeName) => 
    activeNodeName && config ? config.nodes[activeNodeName] : null,
  $activeNodeName
);

export const $isLoading = fetchWorkflowFx.pending;

export const $nodesList = $workflowConfig.map(
  config => config ? Object.keys(config.nodes) : []
);

export const $currentNodeIndex = $nodesList.map(
  (nodesList, activeNodeName) => 
    activeNodeName ? nodesList.indexOf(activeNodeName) + 1 : 0,
  $activeNodeName
);

export const $totalNodesCount = $nodesList.map(nodesList => nodesList.length);

// Sample logic
sample({
  clock: setWorkflowName,
  target: fetchWorkflowFx,
});

// Когда конфиг загружен и нет активного узла, выбираем первый
sample({
  clock: fetchWorkflowFx.doneData,
  source: $activeNodeName,
  filter: (activeNodeName, config) => !activeNodeName && config && Object.keys(config.nodes).length > 0,
  fn: (_, config) => Object.keys(config.nodes)[0],
  target: setActiveNode,
});

// Обработка клика по узлу
sample({
  clock: nodeClicked,
  source: $workflowConfig,
  filter: (config, nodeName) => Boolean(config && config.nodes[nodeName]),
  fn: (_, nodeName) => nodeName,
  target: setActiveNode,
});