import { createFrontNrpcClientConfig } from "signal-channel";
import { createAgentServiceClient } from "g-agent";

const agentClient = createAgentServiceClient(
	createFrontNrpcClientConfig({ target: "centimanus" }),
);

export { agentClient };
