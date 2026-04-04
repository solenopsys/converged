import { createDomain, sample } from "effector";
import { createDomainLogger } from "front-core";
import dagClient from "./service";

const domain = createDomain('dag');
createDomainLogger(domain);

// Code sources
export const loadCodeSourcesFx = domain.createEffect({
  handler: async () => {
    const result = await dagClient.codeSourceList();
    return result.names as string[];
  }
});

export const $codeSources = domain.createStore<string[]>([])
  .on(loadCodeSourcesFx.doneData, (_, names) => names);

export const $codeSourceOptions = $codeSources.map(sources =>
  sources.map(name => ({ value: name, label: name }))
);

// Code sources for providers
export const loadProviderCodeSourcesFx = domain.createEffect({
  handler: async () => {
    const result = await dagClient.providerCodeSourceList();
    return result.names as string[];
  }
});

export const $providerCodeSources = domain.createStore<string[]>([])
  .on(loadProviderCodeSourcesFx.doneData, (_, names) => names);

export const $providerCodeSourceOptions = $providerCodeSources.map(sources =>
  sources.map(name => ({ value: name, label: name }))
);

// Existing providers list
export const loadProvidersListFx = domain.createEffect({
  handler: async () => {
    const result = await dagClient.providerList();
    return result.names as string[];
  }
});

export const $providersList = domain.createStore<string[]>([])
  .on(loadProvidersListFx.doneData, (_, names) => names);

export const $providersOptions = $providersList.map(providers =>
  providers.map(name => ({ value: name, label: name }))
);

// Nodes list for dropdowns
export const loadNodesListFx = domain.createEffect({
  handler: async () => {
    const result = await dagClient.nodeList();
    return result.names as string[];
  }
});

export const $nodesList = domain.createStore<string[]>([])
  .on(loadNodesListFx.doneData, (_, names) => names);

export const $nodesOptions = $nodesList.map(nodes =>
  nodes.map(name => ({ value: name, label: name }))
);

// Load all on init
export const initDagData = domain.createEvent();

sample({
  clock: initDagData,
  target: [loadCodeSourcesFx, loadProvidersListFx, loadNodesListFx]
});

export default domain;
