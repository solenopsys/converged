import { type Provider, ProviderState } from "../dag-api";

interface GeminiCall {
  system?: string;
  user: string;
  model?: string;
  thinkingBudget?: number;
  jsonSchema?: { name: string; schema: Record<string, any>; strict?: boolean };
}

interface GeminiResult {
  body: string;
}

function stripAdditionalProperties(schema: Record<string, any>): Record<string, any> {
  const clone = { ...schema };
  delete clone.additionalProperties;
  if (clone.properties) {
    const props: Record<string, any> = {};
    for (const [key, value] of Object.entries(clone.properties)) {
      props[key] = typeof value === "object" && value !== null
        ? stripAdditionalProperties(value as Record<string, any>)
        : value;
    }
    clone.properties = props;
  }
  if (clone.items && typeof clone.items === "object") {
    clone.items = stripAdditionalProperties(clone.items as Record<string, any>);
  }
  return clone;
}

export default class GeminiProvider implements Provider {
  readonly name = "gemini";
  private _state: ProviderState = ProviderState.STOPPED;
  private token: string;
  private model?: string;

  constructor(token: string, model?: string) {
    this._state = ProviderState.STARTING;
    this.token = token;
    this.model = model;
    this._state = ProviderState.READY;
  }

  get state(): ProviderState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state !== ProviderState.READY) {
      this._state = ProviderState.READY;
    }
  }

  async stop(): Promise<void> {
    this._state = ProviderState.STOPPED;
  }

  isReady(): boolean {
    return this._state === ProviderState.READY;
  }

  async invoke(operation: string, params: GeminiCall): Promise<GeminiResult> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    if (operation === "request") {
      return await this.request(params);
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  async request(req: GeminiCall): Promise<GeminiResult> {
    const model = req.model ?? this.model;
    if (!model) throw new Error("GeminiProvider: model is required (set in constructor or pass in request)");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.token}`;

    const contents: any[] = [];
    if (req.system) {
      // system instruction is separate in Gemini API
    }
    contents.push({
      role: "user",
      parts: [{ text: req.user }],
    });

    const body: Record<string, any> = { contents };

    if (req.system) {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }

    const generationConfig: Record<string, any> = {};

    if (req.jsonSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = stripAdditionalProperties(req.jsonSchema.schema);
    }

    if (req.thinkingBudget != null) {
      body.thinkingConfig = { thinkingBudget: req.thinkingBudget };
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(
        `Gemini API error ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { body: text };
  }
}
