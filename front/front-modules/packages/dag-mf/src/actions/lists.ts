import { ListView, Widget, Action, present } from "converged-core";
import { createEffect, createEvent } from "effector";
import dagClient from "../service";

function wrap(func: () => Promise<{ names: string[] }>) {
    return async () => (await func()).names.map((name: string) => ({ id: name, title: name }))
}

// Effects
export const nodeListFx = createEffect(wrap(dagClient.nodeList));
export const codeSourceListFx = createEffect(wrap(dagClient.codeSourceList));
export const providerListFx = createEffect(wrap(dagClient.providerList));
export const workflowListFx = createEffect(wrap(dagClient.workflowList));

// Events
export const openNodeEvent = createEvent<{ id: string }>();
export const openCodeSourceEvent = createEvent<{ id: string }>();
export const openProviderEvent = createEvent<{ id: string }>();
export const openWorkflowEvent = createEvent<{ id: string }>();

// Widgets
const NodesListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: async () => {
        const data = await nodeListFx();
        console.log("NODES LIST", data);
        return {
            items: data || [],
            title: "Узлы"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openNodeEvent({ id });
        }
    }
};

const CodeSourceListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: async () => {
        const data = await codeSourceListFx();
        console.log("CODE SOURCE LIST", data);
        return {
            items: data || [],
            title: "Исходные коды"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openCodeSourceEvent({ id });
        }
    }
};

const ProvidersListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: async () => {
        const data = await providerListFx();
        console.log("PROVIDERS LIST", data);
        return {
            items: data || [],
            title: "Провайдеры"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openProviderEvent({ id });
        }
    }
};

const WorkflowsListWidget: Widget<typeof ListView> = {
    view: ListView,
    placement: (ctx) => "center",
    mount: async () => {
        const data = await workflowListFx();
        console.log("WORKFLOWS LIST", data);
        return {
            items: data || [],
            title: "Workflow"
        }
    },
    commands: {
        onSelect: (id) => {
            console.log("SELECT", id);
            openWorkflowEvent({ id });
        }
    }
};

// Actions
const ShowNodesListAction: Action = {
    id: "dag.show_nodes_list",
    description: "Просмотреть список узлов",
    invoke: () => {
        present(NodesListWidget, NodesListWidget.placement({}));
    }
};

const GetNodesListAction: Action = {
    id: "dag.get_nodes_list",
    description: "Получить список узлов",
    invoke: async () => {
        return await nodeListFx();
    }
};

const ShowCodeSourceListAction: Action = {
    id: "dag.show_code_source_list",
    description: "Просмотреть список исходных кодов",
    invoke: () => {
        present(CodeSourceListWidget, CodeSourceListWidget.placement({}));
    }
};

const GetCodeSourceListAction: Action = {
    id: "dag.get_code_source_list",
    description: "Получить список исходных кодов",
    invoke: async () => {
        return await codeSourceListFx();
    }
};

const ShowProvidersListAction: Action = {
    id: "dag.show_providers_list",
    description: "Просмотреть список провайдеров",
    invoke: () => {
        present(ProvidersListWidget, ProvidersListWidget.placement({}));
    }
};

const GetProvidersListAction: Action = {
    id: "dag.get_providers_list",
    description: "Получить список провайдеров",
    invoke: async () => {
        return await providerListFx();
    }
};

const ShowWorkflowsListAction: Action = {
    id: "dag.show_workflows_list",
    description: "Просмотреть список workflow",
    invoke: () => {
        present(WorkflowsListWidget, WorkflowsListWidget.placement({}));
    }
};

const GetWorkflowsListAction: Action = {
    id: "dag.get_workflows_list",
    description: "Получить список workflow",
    invoke: async () => {
        return await workflowListFx();
    }
};

export {
    NodesListWidget,
    CodeSourceListWidget,
    ProvidersListWidget,
    WorkflowsListWidget,

    ShowNodesListAction,
    GetNodesListAction,
    ShowCodeSourceListAction,
    GetCodeSourceListAction,
    ShowProvidersListAction,
    GetProvidersListAction,
    ShowWorkflowsListAction,
    GetWorkflowsListAction
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