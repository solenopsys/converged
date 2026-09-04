import { createEffect, createEvent, sample } from "effector";
import ContextViewer from "../../../../../front-core/src/components/json-renderer";
import DagViewer from "../components/DagViewer";
import NodeForm from "../components/NodeForm";
import { NODE_TYPE_MAP } from "../components/nodeConfig";
import Versions from "../components/Versions";
import dagClient from "../service";
import { ACTION_IDS } from "./ids";

export type {
	CodeVersionsWidget,
	ContextWidget,
	EditNodeAction,
	EditNodeWidget,
	GetCodeVersionsAction,
	ShowCodeVersionsAction,
	ShowContextAction,
	ShowLambdaAction,
	ShowWorkflowsDetailAction,
	WorkflowsDetailWidget,
};

export default [
	EditNodeAction,
	ShowWorkflowsDetailAction,
	ShowContextAction,
	ShowCodeVersionsAction,
	GetCodeVersionsAction,
	ShowLambdaAction,
];
