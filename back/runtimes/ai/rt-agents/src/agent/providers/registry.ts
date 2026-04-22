import type { LLMProvider } from "./base";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";

interface ProviderSpec {
  name: string;
  keywords: string[];
  factory: (apiKey: string) => LLMProvider;
}

const PROVIDER_SPECS: ProviderSpec[] = [
  {
    name: "anthropic",
    keywords: ["claude", "anthropic"],
    factory: (apiKey) => new ClaudeProvider(apiKey),
  },
  {
    name: "openai",
    keywords: ["gpt", "openai", "o1", "o3", "o4"],
    factory: (apiKey) => new OpenAIProvider(apiKey),
  },
];

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private apiKeys: Map<string, string>;

  constructor(apiKeys: { anthropic?: string; openai?: string }) {
    this.apiKeys = new Map();
    if (apiKeys.anthropic) this.apiKeys.set("anthropic", apiKeys.anthropic);
    if (apiKeys.openai) this.apiKeys.set("openai", apiKeys.openai);
  }

  getProviderForModel(model: string): LLMProvider {
    const modelLower = model.toLowerCase();

    for (const spec of PROVIDER_SPECS) {
      if (spec.keywords.some((kw) => modelLower.includes(kw))) {
        return this.getOrCreate(spec);
      }
    }

    // Default: first provider with a key
    for (const spec of PROVIDER_SPECS) {
      if (this.apiKeys.has(spec.name)) {
        return this.getOrCreate(spec);
      }
    }

    throw new Error("No LLM provider configured");
  }

  private getOrCreate(spec: ProviderSpec): LLMProvider {
    if (this.providers.has(spec.name)) {
      return this.providers.get(spec.name)!;
    }

    const apiKey = this.apiKeys.get(spec.name);
    if (!apiKey) {
      throw new Error(`No API key for provider: ${spec.name}`);
    }

    const provider = spec.factory(apiKey);
    this.providers.set(spec.name, provider);
    return provider;
  }
}
