// src/nodes/ai-request.ts
import { Store } from "../core/store";
import { type INode, type BaseNodeConfig } from "../core/types";
import { OpenAiProvider } from "../provider/openai-provider";


export class AiRequest implements INode {
	public name: string;
	public scope = "ai";

	private template: { system: string; user: string };
	private provider: OpenAiProvider;
	private wrapName: string;
	private decodeJson: boolean;

	constructor(
		name: string,
		config: { system: string; user: string },
		provider: string,
		providers: Record<string, OpenAiProvider>,
		wrapName: string,
		decodeJson?: boolean,

	) {
		this.name = name;
		this.template = config;
		this.provider = this.providers[provider];
		this.wrapName = wrapName;
		this.decodeJson = decodeJson ?? false;
	}

	async execute(data: unknown): Promise<unknown> {
		const userData = JSON.stringify(data);
		const userText = this.template.user.replace("{{data}}", userData);

		const { body } = await this.provider.request({
			system: this.template.system,
			user: userText,
		});

		console.log(`INFO: AiRequest (id: ${this.name}) received body:`, body);

		let responseData: unknown = body;
		if (this.decodeJson) {
			try {
				const cleanedBody = body.replace(/^```json\s*([\s\S]*?)\s*```$/, "$1");
				responseData = JSON.parse(cleanedBody);
			} catch (e: any) {
				console.error(
					`AiRequest (id: ${this.name}): Failed to parse JSON response. Error: ${e.message}. Body: ${body}`,
				);
				throw new Error(
					`AiRequest (id: ${this.name}): Failed to parse JSON response.`,
				);
			}
		}

		const wrappedOutput = {
			[this.wrapName]: responseData,
		};

		return wrappedOutput;
	}
}
