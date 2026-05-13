import { Conversation } from "./conversation";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { getAnthropicClient, getOpenAIClient, getGeminiClient } from "./aiClients";
import { ServiceType } from "../types";

export class SimpleConversationFactory {
  constructor(private readonly config: { openaiApiKey?: string; anthropicApiKey?: string; geminiApiKey?: string } = {}) {}

  create(serviceType: ServiceType, model: string): Conversation {
    switch (serviceType) {
      case ServiceType.OPENAI: {
        const key = this.config.openaiApiKey;
        if (!key) throw new Error("No OpenAI API key configured");
        return new Conversation(new OpenAIProvider(getOpenAIClient(key)), model);
      }
      case ServiceType.ANTHROPIC: {
        const key = this.config.anthropicApiKey;
        if (!key) throw new Error("No Anthropic API key configured");
        return new Conversation(new ClaudeProvider(getAnthropicClient(key)), model);
      }
      case ServiceType.GEMINI: {
        const key = this.config.geminiApiKey;
        if (!key) throw new Error("No Gemini API key configured");
        return new Conversation(new GeminiProvider(getGeminiClient(key)), model);
      }
      default:
        throw new Error(`Unsupported service type: ${serviceType}`);
    }
  }
}
