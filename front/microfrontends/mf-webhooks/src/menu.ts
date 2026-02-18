import { SHOW_ENDPOINTS_LIST } from "./functions/endpoints.config";
import { SHOW_WEBHOOK_LOGS } from "./functions/logs.config";

export const MENU = {
  title: "menu.webhooks",
  iconName: "IconShare3",
  items: [
    {
      title: "menu.webhooks.endpoints",
      key: "endpoints",
      action: SHOW_ENDPOINTS_LIST,
    },
    {
      title: "menu.webhooks.logs",
      key: "logs",
      action: SHOW_WEBHOOK_LOGS,
    },
  ],
};
