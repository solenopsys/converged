import { StatCard, Widget, Action,  } from "converged-core";
import { createEffect, createEvent,sample } from "effector";
import dagClient from "../service";

// Events and Effects
export const getWorkflowsStatFx = createEffect(async () => {
    const data = await dagClient.workflowList();
    return data.names.length;
});

export const getWorkflowsStatRequest = createEvent();

// Widget
const WorkflowsStatisticWidget: Widget<typeof StatCard> = {
    view: StatCard,
    placement: (ctx) => "float",
    mount: () => getWorkflowsStatRequest(),
    commands: {
        refresh: () => getWorkflowsStatRequest()
    }
};

// Actions
const ShowWorkflowsStatisticAction: Action = {
    id: "dag.show_workflows_statistic",
    description: "Показать общее количество workflow",
    invoke: () => {
        present(WorkflowsStatisticWidget);
    }
};

const GetWorkflowsStatisticAction: Action = {
    id: "dag.get_workflows_statistic",
    description: "Получить общее количество workflow",
    invoke: () => getWorkflowsStatRequest()
};

// Sample connections
sample({ clock: getWorkflowsStatRequest, target: getWorkflowsStatFx });
export  {
    WorkflowsStatisticWidget,
}
export default [
  
    ShowWorkflowsStatisticAction,
    GetWorkflowsStatisticAction
];