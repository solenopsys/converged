export type ProviderDefinition = {
  code: string;
  title?: string;
  actions: string[];
};

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  nrpc: {
    code: "nrpc",
    title: "NRPC Call",
    actions: ["call"],
  },
  dag: {
    code: "dag",
    title: "DAG Workflow",
    actions: ["runWorkflow"],
  },
  log: {
    code: "log",
    title: "Log",
    actions: ["log"],
  },
};

export const listProviderDefinitions = () => Object.values(PROVIDER_DEFINITIONS);

export const getProviderDefinition = (code: string) => PROVIDER_DEFINITIONS[code];
