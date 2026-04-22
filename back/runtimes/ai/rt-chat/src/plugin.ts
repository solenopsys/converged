import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata as chatMetadata } from "g-rt-chat";
import { ChatRuntimeService } from "./service";

export type ChatRuntimePluginConfig = {
  openai?: { key?: string; model?: string };
  claude?: { key?: string; model?: string };
  gemini?: { key?: string; model?: string };
};

export default function chatRuntimePlugin(config: ChatRuntimePluginConfig = {}) {
  const chatService = new ChatRuntimeService({
    openai: config.openai,
    claude: config.claude,
    gemini: config.gemini,
  });

  const assistantBackend = createHttpBackend({
    metadata: chatMetadata,
    serviceImpl: chatService,
    pathPrefix: "/runtime",
  })(config);

  return (app: Elysia) => app.use(assistantBackend);
}
