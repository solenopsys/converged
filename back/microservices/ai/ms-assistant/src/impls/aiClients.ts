import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let openaiClient: OpenAI | null = null;
let openaiKey: string | undefined;

let anthropicClient: Anthropic | null = null;
let anthropicKey: string | undefined;

export function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
    openaiKey = apiKey;
    return openaiClient;
  }

  if (openaiKey && apiKey !== openaiKey) {
    throw new Error("OpenAI client already initialized with a different apiKey");
  }

  return openaiClient;
}

export function getAnthropicClient(apiKey: string): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
    anthropicKey = apiKey;
    return anthropicClient;
  }

  if (anthropicKey && apiKey !== anthropicKey) {
    throw new Error("Anthropic client already initialized with a different apiKey");
  }

  return anthropicClient;
}
