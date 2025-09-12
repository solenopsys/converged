import DagViewer from "../components/DagViewer";
import NodeForm from "../components/NodeForm";
import ContextViewer from "../components/ContextViewer";
import Versions from "../components/Versions";
import { Widget, Action  } from "converged-core";
import { createEffect, createEvent,sample } from "effector";
import dagClient from "../service";

// Events and Effects
export const getCodeVersionsFx = createEffect(dagClient.getCodeSourceVersions);
export const editNodeEvent = createEvent<{ nodeId: string }>();
export const showWorkflowEvent = createEvent<{ workflowId: string }>();
export const showContextEvent = createEvent<{ contextId: string }>();
export const getVersionsRequest = createEvent<{ page?: number; after?: string }>();

// Widgets
const EditNodeWidget: Widget<typeof NodeForm> = {
    view: NodeForm,
    placement: (ctx) => "center",
    mount: () => { },
    commands: {
        sendMail: () => {
            // Handle sendMail command
        }
    }
};

const WorkflowsDetailWidget: Widget<typeof DagViewer> = {
    view: DagViewer,
    placement: (ctx) => "right",
    mount: () => { },
    commands: {
        response: () => {
            // Handle response command
        }
    }
};

const ContextWidget: Widget<typeof ContextViewer> = {
    view: ContextViewer,
    placement: (ctx) => "center",
    mount: () => { },
    commands: {
        response: () => {
            // Handle response command
        }
    }
};

const CodeVersionsWidget: Widget<typeof Versions> = {
    view: Versions,
    placement: (ctx) => "center",
    mount: ({ page, after }) => getVersionsRequest({ page, after }),
    commands: {
        response: () => {
            // Handle response command
        }
    }
};

// Actions
const EditNodeAction: Action = {
    id: "dag.edit_node",
    description: "Редактирование узла",
    invoke: () => {
        present(EditNodeWidget);
    }
};

const ShowWorkflowsDetailAction: Action = {
    id: "dag.show_workflow",
    description: "Просмотр workflow",
    invoke: () => {
        present(WorkflowsDetailWidget);
    }
};

const ShowContextAction: Action = {
    id: "dag.show_context",
    description: "Просмотр контекста",
    invoke: () => {
        present(ContextWidget);
    }
};

const ShowCodeVersionsAction: Action = {
    id: "dag.show_versions",
    description: "Просмотр версий кода",
    invoke: () => {
        present(CodeVersionsWidget);
    }
};

const GetCodeVersionsAction: Action = {
    id: "dag.get_versions",
    description: "Получить версии кода",
    invoke: ({ page, after }) => getVersionsRequest({ page, after })
};

// Sample connections
sample({ clock: getVersionsRequest, target: getCodeVersionsFx });

export {
    EditNodeWidget,
    WorkflowsDetailWidget,
    ContextWidget,
    CodeVersionsWidget,
    EditNodeAction,
    ShowWorkflowsDetailAction,
    ShowContextAction,
    ShowCodeVersionsAction,
    GetCodeVersionsAction
}

export default [

    EditNodeAction,
    ShowWorkflowsDetailAction,
    ShowContextAction,
    ShowCodeVersionsAction,
    GetCodeVersionsAction
];