import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import {
	createPushRouterServiceClient,
	type PushRouterServiceClient,
} from "g-pushrouter/browser";

/**
 * `<user> <name> [title…]` — recipient first because that is the field a
 * mistake is most expensive in. Omitting the user addresses the whole tenant,
 * which is deliberate but has to be asked for with a literal `-`.
 */
function parsePublishParam(param?: string) {
	const [recipient, name, ...rest] = (param ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!name) return null;
	return {
		user: recipient === "-" ? undefined : recipient,
		name,
		title: rest.length > 0 ? rest.join(" ") : undefined,
	};
}

const publishHandler: Handler = async (
	client: PushRouterServiceClient,
	_splitter,
	param,
) => {
	const parsed = parsePublishParam(param);
	if (!parsed) {
		console.error("usage: pushrouter publish <user|-> <event.name> [title]");
		return;
	}
	const result = await client.publish({
		name: parsed.name,
		user: parsed.user,
		level: "info",
		title: parsed.title ?? parsed.name,
	});
	// The delivered count is the useful part: zero means nobody was connected,
	// not that the call failed.
	printJson(result);
};

const historyHandler: Handler = async (
	client: PushRouterServiceClient,
	_splitter,
	param,
) => {
	const limit = param ? Number(param) : undefined;
	printJson(await client.history(Number.isFinite(limit) ? limit : undefined));
};

class PushRouterProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"publish",
				{
					handler: publishHandler,
					description: "Send a notification: <user|-> <event.name> [title]",
				},
			],
			[
				"history",
				{
					handler: historyHandler,
					description: "Replay your own notifications (default: 50)",
				},
			],
		]);
	}
}

export default () =>
	new PushRouterProcessor(
		createPushRouterServiceClient(
			createCliNrpcClientConfig({ target: "fujin" }),
		),
	);
