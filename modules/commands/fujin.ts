import {
	createRuntimeFujinServiceClient,
	type RuntimeFujinServiceClient,
} from "../generated/g-rt-fujin/src/browser";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "../cli/src/base";
import { createCliNrpcClientConfig } from "../cli/src/ws";

const stateHandler: Handler = async (client: RuntimeFujinServiceClient) => {
	printJson(await client.state());
};

function parseMessagesParam(param?: string): { limit?: number; needle?: string } {
	const tokens = param?.trim().split(/\s+/).filter(Boolean) ?? [];
	const words: string[] = [];
	let limit: number | undefined;
	for (const token of tokens) {
		const match = /^(?:n=)?(\d+)$/.exec(token);
		if (match) limit = Number(match[1]);
		else words.push(token);
	}
	return { limit, needle: words.join(" ").toLowerCase() || undefined };
}

const messagesHandler: Handler = async (client: RuntimeFujinServiceClient, _splitter, param) => {
	const { limit, needle } = parseMessagesParam(param);
	const result = await client.messages(limit);
	const messages = result.messages ?? [];
	const filtered = needle
		? messages.filter((message) =>
			["target", "service", "method", "action", "kind", "transport"].some(
				(key) => String(message[key] ?? "").toLowerCase().includes(needle),
			),
		)
		: messages;
	printJson({ ...result, count: filtered.length, messages: filtered });
};

const logsHandler: Handler = async (client: RuntimeFujinServiceClient, _splitter, param) => {
	const { limit, needle } = parseMessagesParam(param);
	for await (const snapshot of client.logs(limit)) {
		const messages = needle
			? snapshot.messages.filter((message) => JSON.stringify(message).toLowerCase().includes(needle))
			: snapshot.messages;
		printJson({ ...snapshot, count: messages.length, messages });
	}
};

class FujinProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			["state", { handler: stateHandler, description: "Show Fujin topology" }],
			["messages", { handler: messagesHandler, description: "Show Fujin journal" }],
			["logs", { handler: logsHandler, description: "Stream Fujin journal" }],
		]);
	}
}

export default () => new FujinProcessor(
	createRuntimeFujinServiceClient(createCliNrpcClientConfig({ target: "fujin" })),
);
