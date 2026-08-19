import { createDomain, sample } from 'effector';
import { createInfiniteTableStore } from 'front-core';
import type { InfiniteTableDataFunction } from 'front-core/table';
import { createRuntimeDagServiceClient } from 'g-rt-dag';
import { createFrontNrpcClientConfig } from 'signal-channel';

const dagClient = createRuntimeDagServiceClient(createFrontNrpcClientConfig({ target: "centimanus" }));

const domain = createDomain('dag-workflows');

export const workflowsViewMounted = domain.createEvent('WORKFLOWS_VIEW_MOUNTED');
export const refreshWorkflowsClicked = domain.createEvent('REFRESH_WORKFLOWS_CLICKED');
export const addWorkflowClicked = domain.createEvent('ADD_WORKFLOW_CLICKED');
export const openWorkflowForm = domain.createEvent<{ workflow: any }>('OPEN_WORKFLOW_FORM');

const listWorkflowsFx = domain.createEffect<Parameters<InfiniteTableDataFunction>[0], any>({
  name: 'LIST_WORKFLOWS',
  handler: async () => {
    const result = await dagClient.listWorkflows();
    const items = result.names.map((name: string) => ({
      name,
      description: '',
      nodesCount: 0,
    }));
    return {
      items,
      totalCount: items.length,
    };
  }
});

export const $workflowsStore = createInfiniteTableStore(domain, listWorkflowsFx);

// Current workflow being edited
export const $currentWorkflow = domain.createStore<any>(null);
sample({ clock: openWorkflowForm, fn: ({ workflow }) => workflow || null, target: $currentWorkflow });

sample({
  clock: workflowsViewMounted,
  filter: () => {
    const state = $workflowsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $workflowsStore.loadMore
});

// Refresh action
sample({
  clock: refreshWorkflowsClicked,
  fn: () => ({}),
  target: $workflowsStore.reset
});

sample({
  clock: refreshWorkflowsClicked,
  fn: () => ({}),
  target: $workflowsStore.loadMore
});

export default domain;
