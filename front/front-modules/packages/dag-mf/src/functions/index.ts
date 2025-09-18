import CODE_SOURCE_ACTIONS from "./code-source.config";
import CODE_VERSION_ACTIONS from "./code-version.config";
import CONTEXT_ACTIONS from "./context";
import LAMBDA_ACTIONS from "./lambda";
import NODE_ACTIONS from "./node.config";
import PROVIDER_ACTIONS from "./provider.config";
import WORKFLOW_ACTIONS from "./wokflow";



const ACTIONS=[
    ...WORKFLOW_ACTIONS,
    ...NODE_ACTIONS,
    ...PROVIDER_ACTIONS,
    ...LAMBDA_ACTIONS,
    ...CONTEXT_ACTIONS,
    ...CODE_VERSION_ACTIONS,
    ...CODE_SOURCE_ACTIONS
];

export { ACTIONS};
