 

import DagViewer from "../components/DagViewer";
import NodeForm from "../components/NodeForm";
import ContextViewer from "../components/ContextViewer";
import Versions from "../components/Versions";
 
import dagClient from "../service";
 
 
  

const EditNodeCap = {
    description: "Редактирование узла",
    views: [NodeForm],
    show: ["center"],
    commands: { "sendMail": { name: open  } },
    
}

const WorkflowsDetailCap = {
    description: "Просмотр workflow",
    views: [DagViewer],
    show: ["right"],
    commands: { "response": { name: open  } },

}

const ContextCap = {
    description: "Просмотр контекста",
    views: [ContextViewer],
    show: ["center"],
    commands: { "response": { name: open  } },

}

const CodeVersionsCap = {
    description: "Просмотр версий кода",
    views: [Versions],
    show: ["center"],
    commands: { "response": { name: open  } },
    dataSource: dagClient.getCodeSourceVersions,
}

export { EditNodeCap, WorkflowsDetailCap, ContextCap, CodeVersionsCap };