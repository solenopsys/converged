import { createDomain, sample } from 'effector';
import { createInfiniteTableStore, PaginationParams } from 'front-core';
import dagClient from './service';

const domain = createDomain('dag-workflows');

// Events
export const workflowsViewMounted = domain.createEvent('WORKFLOWS_VIEW_MOUNTED');
export const refreshWorkflowsClicked = domain.createEvent('REFRESH_WORKFLOWS_CLICKED');
export const addWorkflowClicked = domain.createEvent('ADD_WORKFLOW_CLICKED');
export const openWorkflowForm = domain.createEvent<{ workflow: any }>('OPEN_WORKFLOW_FORM');

// Effects
const listWorkflowsFx = domain.createEffect<PaginationParams, any>({
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

// Store
export const $workflowsStore = createInfiniteTableStore(domain, listWorkflowsFx);

// Current workflow being edited
export const $currentWorkflow = domain.createStore<any>(null);
sample({ clock: openWorkflowForm, fn: ({ workflow }) => workflow || null, target: $currentWorkflow });

// Load data when view mounts
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
