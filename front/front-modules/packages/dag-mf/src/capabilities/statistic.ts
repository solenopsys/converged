import { StatCard } from "converged-core";
import dagClient from "../service";
 

const WorkflowsStatisticCap = {
    description: "Общее количество workflow",
    views: [StatCard],
    show: ["float"],
    dataSource: dagClient.workflowList,
    dataTransform: (data) => data.names.length
}

export { WorkflowsStatisticCap };