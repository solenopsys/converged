import { createDomain, sample } from "effector";
import type { ProviderDefinition } from "g-webhooks";
import webhooksService from "./service";

const domain = createDomain("webhooks-endpoints");

export const openEndpointForm = domain.createEvent<{ endpoint: any }>(
	"OPEN_ENDPOINT_FORM",
);
export const providersRequested = domain.createEvent("PROVIDERS_REQUESTED");

const loadProvidersFx = domain.createEffect({
	name: "LOAD_PROVIDERS",
	handler: async () => {
		return await webhooksService.listProviders();
	},
});

const formatEndpointForForm = (endpoint: any) => {
	if (!endpoint) {
		return null;
	}
	return {
		...endpoint,
		params: endpoint.params ? JSON.stringify(endpoint.params, null, 2) : "",
	};
};

export const $currentEndpoint = domain
	.createStore<any>(null)
	.on(openEndpointForm, (_state, { endpoint }) =>
		formatEndpointForForm(endpoint),
	);

export const $providers = domain
	.createStore<ProviderDefinition[]>([])
	.on(loadProvidersFx.doneData, (_state, providers) => providers);

sample({
	clock: providersRequested,
	target: loadProvidersFx,
});

export default domain;
