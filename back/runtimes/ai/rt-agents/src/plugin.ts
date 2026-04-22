import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata as agentMetadata } from "g-agent";
import { AgentRuntimeService } from "./agent/service";

export type AgentsRuntimePluginConfig = {
  openai?: { key?: string; model?: string };
  claude?: { key?: string; model?: string };
};

export default function agentsRuntimePlugin(config: AgentsRuntimePluginConfig = {}) {
  const agentService = new AgentRuntimeService({
    providers: {
      anthropic: { apiKey: config.claude?.key },
      openai: { apiKey: config.openai?.key },
    },
  });
  const agentBackend = createHttpBackend({
    metadata: agentMetadata,
    serviceImpl: agentService,
  })(config);

  return (app: Elysia) => app.use(agentBackend);
}
