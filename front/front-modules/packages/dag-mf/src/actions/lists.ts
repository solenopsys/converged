import { ListView, Widget, Action,  } from "converged-core";
import { createEffect, createEvent,sample } from "effector";
import dagClient from "../service";

function wrap(func: () => Promise<{ names: string[] }>) {
    return async () => (await func()).names.map((name: string) => ({ id: name, title: name }))
}

// Events and Effects
export const nodeListFx = createEffect(wrap(dagClient.nodeList));
export const codeSourceListFx = createEffect(wrap(dagClient.codeSourceList));
export const providerListFx = createEffect(wrap(dagClient.providerList));
export const workflowListFx = createEffect(wrap(dagClient.workflowList));

export const openNodeEvent = createEvent<{ id: string }>();
export const openCodeSourceEvent = createEvent<{ id: string }>();
export const openProviderEvent = createEvent<{ id: string }>();
export const openWorkflowEvent = createEvent<{ id: string }>();

export const nodeListRequest = createEvent();
export const codeSourceListRequest = createEvent();
export const providerListRequest = createEvent();
export const workflowListRequest = createEvent();

// Widgets
const NodesListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: () => nodeListRequest(),
    commands: {
        rowClick: ({ id }) => openNodeEvent({ id })
    }
};

const CodeSourceListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: () => codeSourceListRequest(),
    commands: {
        rowClick: ({ id }) => openCodeSourceEvent({ id })
    }
};

const ProvidersListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: () => providerListRequest(),
    commands: {
        rowClick: ({ id }) => openProviderEvent({ id })
    }
};

const WorkflowsListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: () => workflowListRequest(),
    commands: {
        rowClick: ({ id }) => openWorkflowEvent({ id })
    }
};

// Actions
const ShowNodesListAction: Action = {
    id: "dag.show_nodes_list",
    description: "Просмотреть список узлов",
    invoke: () => {
        present(NodesListWidget);
    }
};

const GetNodesListAction: Action = {
    id: "dag.get_nodes_list",
    description: "Получить список узлов",
    invoke: () => nodeListRequest()
};

const ShowCodeSourceListAction: Action = {
    id: "dag.show_code_source_list",
    description: "Просмотреть список исходных кодов",
    invoke: () => {
        present(CodeSourceListWidget);
    }
};

const GetCodeSourceListAction: Action = {
    id: "dag.get_code_source_list",
    description: "Получить список исходных кодов",
    invoke: () => codeSourceListRequest()
};

const ShowProvidersListAction: Action = {
    id: "dag.show_providers_list",
    description: "Просмотреть список провайдеров",
    invoke: () => {
        present(ProvidersListWidget);
    }
};

const GetProvidersListAction: Action = {
    id: "dag.get_providers_list",
    description: "Получить список провайдеров",
    invoke: () => providerListRequest()
};

const ShowWorkflowsListAction: Action = {
    id: "dag.show_workflows_list",
    description: "Просмотреть список workflow",
    invoke: () => {
        present(WorkflowsListWidget);
    }
};

const GetWorkflowsListAction: Action = {
    id: "dag.get_workflows_list",
    description: "Получить список workflow",
    invoke: () => workflowListRequest()
};

// Sample connections
sample({ clock: nodeListRequest, target: nodeListFx });
sample({ clock: codeSourceListRequest, target: codeSourceListFx });
sample({ clock: providerListRequest, target: providerListFx });
sample({ clock: workflowListRequest, target: workflowListFx });

export {
  NodesListWidget,
  CodeSourceListWidget,
  ProvidersListWidget,
  WorkflowsListWidget,
}

export default [
 
    ShowNodesListAction,
    GetNodesListAction,
    ShowCodeSourceListAction,
    GetCodeSourceListAction,
    ShowProvidersListAction,
    GetProvidersListAction,
    ShowWorkflowsListAction,
    GetWorkflowsListAction
];