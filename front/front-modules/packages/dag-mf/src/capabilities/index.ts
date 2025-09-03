import { NodesListCap, CodeSourceListCap, ProvidersListCap, WorkflowsListCap } from "./lists";
import { EditNodeCap, WorkflowsDetailCap, ContextCap, CodeVersionsCap } from "./comands"; ``
import { WorkflowsStatisticCap } from "./statistic";




export const CAPABILITIES = {
    "edit_node": EditNodeCap,
    "workflows_detail": WorkflowsDetailCap,
    "context": ContextCap,
    "code_versions": CodeVersionsCap,
    "nodes_list": NodesListCap,
    "providers_list": ProvidersListCap,
    "codes_list": CodeSourceListCap,
    "workflows_list": WorkflowsListCap,
    "workflows_count": WorkflowsStatisticCap,
}
