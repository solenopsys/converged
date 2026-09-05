import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_WEBHOOK_LOGS = "webhooks.logs.show";

const createShowWebhookLogsAction: CreateAction = () => ({
	id: SHOW_WEBHOOK_LOGS,
	invoke: () => {
		void presentReference(setRef("webhooks.log", { kind: "query" }));
	},
});

export { createShowWebhookLogsAction, SHOW_WEBHOOK_LOGS };

export default [createShowWebhookLogsAction];
