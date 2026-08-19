import { CreateAction, CreateWidget } from "front-core";
import { WebhookLogsView } from "../views/WebhookLogsView";

const SHOW_WEBHOOK_LOGS = "webhooks.logs.show";

const createWebhookLogsWidget: CreateWidget<typeof WebhookLogsView> = (bus) => ({
  view: WebhookLogsView,
  placement: () => "center",
  config: {
    bus,
  },
});

const createShowWebhookLogsAction: CreateAction<any> = (bus) => ({
  id: SHOW_WEBHOOK_LOGS,
  description: "Show webhook logs",
  invoke: () => {
    bus.present({ widget: createWebhookLogsWidget(bus) });
  },
});

export { SHOW_WEBHOOK_LOGS, createShowWebhookLogsAction };

export default [createShowWebhookLogsAction];
