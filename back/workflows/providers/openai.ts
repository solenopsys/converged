import  { type Provider, ProviderState } from "../dag-api";

 

interface ResponsesCall {
	system?: string;
	user: string;
  }
  
  interface ResponsesResult {
	body: string;
  }
  
  export default class OpenAiProvider implements Provider {
	readonly name = "openai";
	private _state: ProviderState = ProviderState.STOPPED;
	private token!: string;
	private model!: string;

	constructor(token: string, model: string) {
		this._state = ProviderState.STARTING;
		this.token = token;
		this.model = model;
		this._state = ProviderState.READY;
	}
  
	get state(): ProviderState {
	  return this._state;
	}
  
 
  
	async start(): Promise<void> {
	  if (this._state === ProviderState.STOPPED) {
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
  
	  if (operation === 'request') {
		return await this.request(params);
	  }
	  
	  throw new Error(`Unknown operation: ${operation}`);
	}
  
	async request(req: ResponsesCall): Promise<ResponsesResult> {
	  const input: any[] = [];
	  if (req.system) {
		input.push({
		  role: "system",
		  content: [{ type: "input_text", text: req.system }],
		});
	  }
	  input.push({
		role: "user",
		content: [{ type: "input_text", text: req.user }],
	  });
  
	  try {
		const res = await fetch("https://api.openai.com/v1/responses", {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${this.token}`,
		  },
		  body: JSON.stringify({
			model: this.model,
			input,
			stream: false,
		  }),
		});
  
		if (!res.ok) {
		  this._state = ProviderState.ERROR;
		  throw new Error(
			`OpenAI Responses API error ${res.status}: ${await res.text()}`,
		  );
		}
  
		const data = (await res.json()) as {
		  output: { content: { text?: string }[] }[];
		};
  
		return { body: data.output?.[0]?.content?.[0]?.text ?? "" };
	  } catch (error) {
		this._state = ProviderState.ERROR;
		throw error;
	  }
	}
  }