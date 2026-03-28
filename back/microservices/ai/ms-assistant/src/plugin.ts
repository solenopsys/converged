import { createHttpBackend } from "nrpc";
import { metadata } from "g-assistant";
import ChatsServiceImpl from "./index";

export type AssistantPluginConfig = {
  dbPath?: string;
};

let serviceImpl: ChatsServiceImpl | null = null;

function getServiceImpl() {
  if (!serviceImpl) {
    serviceImpl = new ChatsServiceImpl({
      openai: {
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL,
      },
      claude: {
        key: process.env.CLAUDE_API_KEY,
        model: process.env.CLAUDE_MODEL,
      },
      gemini: {
        key: process.env.GOOGLE_API_KEY,
        model: process.env.GEMINI_MODEL,
      },
    });
  }
  return serviceImpl;
}

export default createHttpBackend({
  metadata,
  get serviceImpl() {
    return getServiceImpl();
  },
});
