import { createDomain, sample } from "effector";
import type { ProviderDefinition } from "g-sheduller";
import shedullerService from "./service";

const domain = createDomain("sheduller-crons");

export const openCronForm = domain.createEvent<{ cron: any }>("OPEN_CRON_FORM");
export const providersRequested = domain.createEvent("PROVIDERS_REQUESTED");
export const providersLoaded =
	domain.createEvent<ProviderDefinition[]>("PROVIDERS_LOADED");

const loadProvidersFx = domain.createEffect({
	name: "LOAD_PROVIDERS",
	handler: async () => {
		return await shedullerService.listProviders();
	},
});

export const $currentCron = domain.createStore<any>(null);
sample({
	clock: openCronForm,
	fn: ({ cron }) => cron || null,
	target: $currentCron,
});

export const $providers = domain
	.createStore<ProviderDefinition[]>([])
	.on(loadProvidersFx.doneData, (_, providers) => providers);

sample({
	clock: providersRequested,
	target: loadProvidersFx,
});

export default domain;
