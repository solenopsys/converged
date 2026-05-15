import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata as assistantMetadata } from "g-rt-assistant";
import { AssistantRuntimeService } from "./service";

export type AssistantRuntimePluginConfig = {
  openai?: { key?: string; model?: string };
  claude?: { key?: string; model?: string };
  gemini?: { key?: string; model?: string };
  assistant?: { baseUrl?: string };
};

export default function assistantRuntimePlugin(config: AssistantRuntimePluginConfig = {}) {
  const assistantService = new AssistantRuntimeService({
    openai: config.openai,
    claude: config.claude,
    gemini: config.gemini,
    assistant: config.assistant,
  });

  const assistantBackend = createHttpBackend({
    metadata: assistantMetadata,
    serviceImpl: assistantService,
    pathPrefix: "/runtime",
  })(config);

  return (app: Elysia) => app.use(assistantBackend);
}
