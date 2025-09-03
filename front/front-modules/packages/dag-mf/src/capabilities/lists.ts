

import { UniversalList } from "converged-core";
import dagClient from "../service";


const NodesListCap = {
    description: "Просмотреть список узлов",
    menu: "menu.nodes",
    views: [UniversalList],
    show: ["center"],
    commands: { "rowClick": { name: open, params: { "id": "row.id" } } },
    dataSource: dagClient.nodeList,
}

const CodeSourceListCap = {
  description: "Просмотреть список исходных кодов",
  menu: "menu.source",
  views: [UniversalList],
  show: ["center"],
  commands: { "rowClick": { name: open, params: { "id": "row.id" } } },
  dataSource: dagClient.codeSourceList,
}

const ProvidersListCap = {
  description: "Просмотреть список провайдеров",
  menu: "menu.providers",
  views: [UniversalList],
  show: ["center"],
  commands: { "rowClick": { name: open, params: { "id": "row.id" } } },
  dataSource: dagClient.providerList,
}

const WorkflowsListCap = {
  description: "Просмотреть список workflow",
  menu: "menu.workflows",
  views: [UniversalList],
  show: ["center"],
  commands: { "rowClick": { name: open, params: { "id": "row.id" } } },
  dataSource: dagClient.workflowList,
}
 
export { NodesListCap, CodeSourceListCap, ProvidersListCap, WorkflowsListCap };
