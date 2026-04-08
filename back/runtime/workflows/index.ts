export { NODE_DEFINITIONS, getNodeDefinition, listNodeNames } from "./nodes";
export {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  initProvidersPool,
  getProvidersPool,
} from "./providers";

import { SendMagicLinkWorkflow } from "./wf-magic-link";

export const WORKFLOWS = [
  { name: "send-magic-link", ctor: SendMagicLinkWorkflow },
];
