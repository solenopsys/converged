export interface AiConfig {
  key: string;
  model: string;
}

export interface AiProviders {
  openai: AiConfig;
  claude: AiConfig;
  gemini: AiConfig;
}

export function loadAiProvidersFromEnv(): AiProviders {
  return {
    openai: {
      key: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
    claude: {
      key: process.env.CLAUDE_API_KEY || "",
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022",
    },
    gemini: {
      key: process.env.GEMINI_API_KEY || "",
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    },
  };
}
