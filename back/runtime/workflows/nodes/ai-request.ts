// src/nodes/ai-request.ts
import { type INode, type Provider } from "../dag-api";
import { getProvidersPool } from "../providers";



export class AiRequest implements INode {
	public name: string;
	public scope = "ai";

	private template: { system: string; user: string };

	private wrapName: string;
	private decodeJson: boolean;

	constructor(
		name: string,
		config: { system: string; user: string },
		private provider: string,
		wrapName: string,
		decodeJson?: boolean,

	) {
		this.name = name;
		this.template = config;
		this.wrapName = wrapName;
		this.decodeJson = decodeJson ?? false;
	}

	async execute(data: unknown): Promise<unknown> {
		const userData = JSON.stringify(data);
		const userText = this.template.user.replace("{{data}}", userData);
		const realProvider: Provider = await getProvidersPool().getOrCreate(
			this.provider,
		);
		const { body } = await realProvider.invoke("request",{
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
