export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
};

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  delivery: {
    code: "delivery",
    title: "Delivery Updates",
    params: [
      { name: "secret", type: "string", description: "Shared secret" },
      { name: "source", type: "string", description: "Delivery provider name" },
    ],
  },
  payment: {
    code: "payment",
    title: "Payment Notifications",
    params: [
      { name: "secret", type: "string", description: "Shared secret" },
      { name: "currency", type: "string" },
    ],
  },
  order: {
    code: "order",
    title: "Order Status",
    params: [
      { name: "secret", type: "string" },
    ],
  },
  status: {
    code: "status",
    title: "External Status",
    params: [
      { name: "secret", type: "string" },
    ],
  },
  log: {
    code: "log",
    title: "External Logs",
    params: [
      { name: "secret", type: "string" },
      { name: "source", type: "string" },
    ],
  },
  generic: {
    code: "generic",
    title: "Generic Webhook",
    params: [
      { name: "secret", type: "string" },
    ],
  },
};

export const listProviderDefinitions = () => Object.values(PROVIDER_DEFINITIONS);

export const getProviderDefinition = (code: string) => PROVIDER_DEFINITIONS[code];
