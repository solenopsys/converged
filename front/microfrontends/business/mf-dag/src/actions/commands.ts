import DagViewer from "../components/DagViewer";
import NodeForm from "../components/NodeForm";
import ContextViewer from "../../../../../front-core/src/components/json-renderer";
import Versions from "../components/Versions";

import { createEffect, createEvent, sample } from "effector";
import dagClient from "../service";
import { ACTION_IDS } from "./ids";
import { NODE_TYPE_MAP } from "../components/nodeConfig";
 


export { 
    EditNodeWidget,
    WorkflowsDetailWidget,
    ContextWidget,
    CodeVersionsWidget,
    EditNodeAction,
    ShowWorkflowsDetailAction,
    ShowContextAction,
    ShowCodeVersionsAction,
    GetCodeVersionsAction,
    ShowLambdaAction
}

export default [
    EditNodeAction,
    ShowWorkflowsDetailAction,
    ShowContextAction,
    ShowCodeVersionsAction,
    GetCodeVersionsAction,
    ShowLambdaAction
];