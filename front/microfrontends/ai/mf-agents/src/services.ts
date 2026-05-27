import { createRuntimeAgentServiceClient } from "g-rt-agent";

const agentClient = createRuntimeAgentServiceClient({ baseUrl: "/runtime" });

export { agentClient };
