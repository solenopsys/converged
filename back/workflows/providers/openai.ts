import { type Provider, ProviderState } from "../dag-api";

interface ResponsesCall {
  system?: string;
  user: string;
  model?: string;
  reasoning?: string;
  jsonSchema?: { name: string; schema: Record<string, any>; strict?: boolean };
}

interface ResponsesResult {
  body: string;
}

export default class OpenAiProvider implements Provider {
  readonly name = "openai";
  private _state: ProviderState = ProviderState.STOPPED;
  private token!: string;
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

  async invoke(operation: string, params: ResponsesCall): Promise<ResponsesResult> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    if (operation === "request") {
      return await this.request(params);
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  async request(req: ResponsesCall): Promise<ResponsesResult> {
    const model = req.model ?? this.model;
    if (!model) throw new Error("OpenAiProvider: model is required (set in constructor or pass in request)");

    const body: Record<string, any> = {
      model,
      input: req.user,
      stream: false,
    };

    if (req.reasoning) {
      body.reasoning = { effort: req.reasoning };
    }

    if (req.system) {
      body.instructions = req.system;
    }

    if (req.jsonSchema) {
      body.text = {
        format: {
          type: "json_schema",
          name: req.jsonSchema.name,
          schema: req.jsonSchema.schema,
          strict: req.jsonSchema.strict ?? true,
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(
        `OpenAI Responses API error ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      output: { type: string; content: { type: string; text?: string }[] }[];
    };

    const message = data.output?.find((item) => item.type === "message");
    return { body: message?.content?.find((c) => c.type === "output_text")?.text ?? "" };
  }
}
