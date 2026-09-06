import CRONS_ACTIONS from "./crons.config";
import HISTORY_ACTIONS from "./history.config";
import STATS_ACTIONS from "./stats.config";

const ACTIONS = [...CRONS_ACTIONS, ...HISTORY_ACTIONS, ...STATS_ACTIONS];

export { ACTIONS };
