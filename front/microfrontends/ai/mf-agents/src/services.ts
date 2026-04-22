import { createRuntimeAgentServiceClient } from "g-rt-agents";

const agentClient = createRuntimeAgentServiceClient({ baseUrl: "/runtime" });

export { agentClient };
