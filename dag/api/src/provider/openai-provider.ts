// src/provider/openai-provider.ts
import { type Provider } from "../../../src/types";

/** Вход только текст, без мультимедиа-экзотики */
interface ResponsesCall {
	system?: string;
	user: string;
}
interface ResponsesResult {
	body: string;
}

export class OpenAiProvider implements Provider {
	readonly name = "openai";
	constructor(
		private readonly token: string,
		private readonly model: string,
	) {}

	async request(req: ResponsesCall): Promise<ResponsesResult> {
		// собираем массив input в новом формате
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
			throw new Error(
				`OpenAI Responses API error ${res.status}: ${await res.text()}`,
			);
		}

		const data = (await res.json()) as {
			output: { content: { text?: string }[] }[];
		};

		// responses.output[0].content[0].text
		return { body: data.output?.[0]?.content?.[0]?.text ?? "" };
	}
}
