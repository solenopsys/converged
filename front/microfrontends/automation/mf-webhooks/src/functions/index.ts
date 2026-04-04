import ENDPOINT_ACTIONS from "./endpoints.config";
import LOG_ACTIONS from "./logs.config";

const ACTIONS = [...ENDPOINT_ACTIONS, ...LOG_ACTIONS];

export { ACTIONS };
