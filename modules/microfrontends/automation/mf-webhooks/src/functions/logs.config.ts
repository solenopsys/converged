import type { CreateAction, CreateWidget } from "front-core";
import { WebhookLogsView } from "../views/WebhookLogsView";

const SHOW_WEBHOOK_LOGS = "webhooks.logs.show";

const createWebhookLogsWidget: CreateWidget<typeof WebhookLogsView> = (
	bus,
) => ({
	view: WebhookLogsView,
	placement: () => "center",
	config: {
		bus,
	},
});

const createShowWebhookLogsAction: CreateAction<any> = (bus) => ({
	id: SHOW_WEBHOOK_LOGS,
	invoke: () => {
		bus.present({ widget: createWebhookLogsWidget(bus) });
	},
});

export { createShowWebhookLogsAction, SHOW_WEBHOOK_LOGS };

export default [createShowWebhookLogsAction];
