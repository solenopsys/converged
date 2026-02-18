export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type ProviderActionDefinition = {
  name: string;
  description?: string;
  params?: ProviderParam[];
};

export type ProviderDefinition = {
  code: string;
  title?: string;
  settings?: ProviderParam[];
  actions: ProviderActionDefinition[];
};

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  nrpc: {
    code: "nrpc",
    title: "NRPC Call",
    settings: [
      {
        name: "baseUrl",
        type: "string",
        description: "NRPC base URL, e.g. http://localhost:3001/services",
      },
    ],
    actions: [
      {
        name: "call",
        description: "Call any NRPC service method",
        params: [
          { name: "service", type: "string", required: true },
          { name: "method", type: "string", required: true },
          { name: "payload", type: "json" },
        ],
      },
    ],
  },
  dag: {
    code: "dag",
    title: "DAG Workflow",
    actions: [
      {
        name: "runWorkflow",
        description: "Run DAG workflow by name",
        params: [
          { name: "workflow", type: "string", required: true },
          { name: "input", type: "json" },
        ],
      },
    ],
  },
};

export const listProviderDefinitions = () => Object.values(PROVIDER_DEFINITIONS);

export const getProviderDefinition = (code: string) => PROVIDER_DEFINITIONS[code];
