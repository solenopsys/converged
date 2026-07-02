import { createDomain } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { WebhookLogListParams } from "g-webhooks";
import webhooksService from "./service";

const domain = createDomain("webhooks-logs");

const listLogsFx = domain.createEffect<WebhookLogListParams, any>({
	name: "LIST_LOGS",
	handler: async (params: WebhookLogListParams) => {
		return await webhooksService.listLogs(params);
	},
});

export const $logsStore = createInfiniteTableStore(domain, listLogsFx);

export default domain;
