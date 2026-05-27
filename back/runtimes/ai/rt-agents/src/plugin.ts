import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata as agentMetadata } from "g-rt-agent";
import { AgentRuntimeService } from "./agent/service";
import { requestTools } from "./tools/requests";
import { extractorTools } from "./tools/extractors";

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

  for (const tool of [...requestTools, ...extractorTools]) {
    agentService.registerTool(tool);
  }

  const agentBackend = createHttpBackend({
    metadata: agentMetadata,
    serviceImpl: agentService,
    pathPrefix: "/runtime",
  })(config);

  return (app: Elysia) => app.use(agentBackend);
}
