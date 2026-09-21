import { completion } from "../core.ts";
import type { TurnRequest, WireRequest } from "../schema.ts";

type ObjectValue = Record<string, unknown>;

function object(value: unknown, name: string): ObjectValue {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`PARAMS ${name} must be an object`);
	}
	return value as ObjectValue;
}

function lastUserText(messages: TurnRequest["messages"]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "user" && message.content.trim().length > 0) {
			return message.content;
		}
	}
	throw new Error("PARAMS requires a user message");
}

function encodeParams(req: TurnRequest): WireRequest {
	const input = object(req.input, "input");
	const query = typeof input.query === "string" && input.query.length > 0
		? input.query
		: typeof input.text === "string" && input.text.length > 0
			? input.text
			: lastUserText(req.messages);
	const format = object(input.format, "input.format");
	const variants = input.variants === undefined
		? {}
		: object(input.variants, "input.variants");

	return {
		path: "/params",
		method: "POST",
		body: JSON.stringify({ query, format, variants }),
	};
}

export const hooks = {
	encodeTurn(req: TurnRequest): WireRequest {
		switch (req.operation ?? "params") {
			case "params":
			case "extract":
				return encodeParams(req);
			default:
				throw new Error(`PARAMS operation is not supported: ${req.operation}`);
		}
	},

	decodeResponse(raw: unknown) {
		const result = object(raw, "response");
		return completion(JSON.stringify(result), [], "stop", 0, 0);
	},
};
