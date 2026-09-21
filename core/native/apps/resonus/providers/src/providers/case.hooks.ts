import { completion } from "../core.ts";
import type { TurnRequest, WireRequest } from "../schema.ts";

type ObjectValue = Record<string, unknown>;

function object(value: unknown, name: string): ObjectValue {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`CASE ${name} must be an object`);
	}
	return value as ObjectValue;
}

function string(value: unknown, name: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`CASE ${name} must be a non-empty string`);
	}
	return value;
}

function lastUserText(messages: TurnRequest["messages"]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "user" && message.content.trim().length > 0) {
			return message.content;
		}
	}
	throw new Error("CASE route requires a user message");
}

function encodeRoute(req: TurnRequest): WireRequest {
	const input = object(req.input, "route input");
	const context = string(input.context, "route input.context");
	const text = typeof input.text === "string" && input.text.length > 0
		? input.text
		: lastUserText(req.messages);
	const body: ObjectValue = { context, text };
	if (typeof input.language === "string" && input.language.length > 0) {
		body.language = input.language;
	}
	return { path: "/route", method: "POST", body: JSON.stringify(body) };
}

function encodeContextLoad(req: TurnRequest): WireRequest {
	const context = object(req.input, "context.load input");
	string(context.key, "context.load input.key");
	if (!Array.isArray(context.sections)) {
		throw new Error("CASE context.load input.sections must be an array");
	}
	return { path: "/contexts", method: "POST", body: JSON.stringify(context) };
}

export const hooks = {
	encodeTurn(req: TurnRequest): WireRequest {
		switch (req.operation ?? "route") {
			case "route":
				return encodeRoute(req);
			case "context.load":
				return encodeContextLoad(req);
			default:
				throw new Error(`CASE operation is not supported: ${req.operation}`);
		}
	},

	decodeResponse(raw: unknown) {
		const result = object(raw, "response");
		const decision = typeof result.decision === "string" ? result.decision : "";
		const command = typeof result.command === "string" ? result.command : "";
		const toolCalls = decision === "EXECUTE" && command.length > 0
			? [{ id: "case-route", name: command, args: {} }]
			: [];
		return completion(JSON.stringify(result), toolCalls, decision || "stop", 0, 0);
	},
};
