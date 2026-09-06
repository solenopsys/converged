import { SIDEBAR_TABS as dagTabs } from "./dag";
import definition from "./objects";
import { SIDEBAR_TABS as shedullerTabs } from "./sheduller";
import { SIDEBAR_TABS as webhooksTabs } from "./webhooks";

export const SIDEBAR_TABS = [...dagTabs, ...shedullerTabs, ...webhooksTabs];

export default definition;
