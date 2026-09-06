export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type WebhookVerification = "none" | "secret" | "hmac";

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
  verify?: WebhookVerification;
};

export const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  delivery: {
    code: "delivery",
    title: "Delivery Updates",
    verify: "secret",
    params: [
      { name: "secret", type: "string", description: "Shared secret" },
      { name: "source", type: "string", description: "Delivery provider name" },
    ],
  },
  payment: {
    code: "payment",
    title: "Payment Notifications",
    // Money moves on these, and a signature over the body is the only check a
    // replayed or edited delivery cannot pass.
    verify: "hmac",
    params: [
      { name: "secret", type: "string", description: "Shared secret" },
      { name: "currency", type: "string" },
    ],
  },
  order: {
    code: "order",
    title: "Order Status",
    verify: "secret",
    params: [
      { name: "secret", type: "string" },
    ],
  },
  status: {
    code: "status",
    title: "External Status",
    verify: "secret",
    params: [
      { name: "secret", type: "string" },
    ],
  },
  log: {
    code: "log",
    title: "External Logs",
    verify: "secret",
    params: [
      { name: "secret", type: "string" },
      { name: "source", type: "string" },
    ],
  },
  generic: {
    code: "generic",
    title: "Generic Webhook",
    verify: "secret",
    params: [
      { name: "secret", type: "string" },
    ],
  },
};

export const listProviderDefinitions = () => Object.values(PROVIDER_DEFINITIONS);

export const getProviderDefinition = (code: string) => PROVIDER_DEFINITIONS[code];
