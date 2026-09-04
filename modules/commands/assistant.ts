import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { WebSocketRequestMessage } from "nrpc";
import {
	createConversation,
	createResonusChatDriver,
	createResonusCommandTransport,
	createResonusSession,
	type CommandEnvelope,
	type Conversation,
	type ConversationCatalog,
	type EnvelopeChannel,
	type FunctionBrief,
} from "orchestrator";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
} from "dag-cli/base";
import { formatElapsed } from "dag-cli/timing";
import { cliWebSocketChannel } from "dag-cli/ws";

// Interactive chat with the AI through Fujin. The turn itself — steps, answer,
// tool rounds and their budget — belongs to `orchestrator`, so this file is only
// what is genuinely CLI: the command catalog it exposes as functions, and the
// console as a view over the conversation stores.
//
// The catalog the steps choose from is this CLI's own sections and commands, so
// the whole contour runs without a browser. Where the tab publishes its
// surfaces, here the command map is published instead.

const CHAT_DEADLINE_MS = 120_000;

// The record every host names: `data-context="chat"` in the SPA and the embed.
// Override with a param or ASSISTANT_CONTEXT; a missing record is an error.
const CHAT_CONTEXT = "chat";

type ChatConfig = {
	contextName?: string;
	provider?: string;
	model?: string;
	language?: string;
	endpoint: string;
};

export type CliSection = {
	commands?: string[];
	catalog?: Array<{ command: string; description: string }>;
	processCommand(command: string, param?: string): Promise<void>;
};

const dim = (text: string): string => `\x1b[2m${text}\x1b[0m`;

// `bun cli` imports only the section it was asked for; the catalog needs them
// all, so it re-reads the same --commands dirs the entry point was given.
async function loadSections(): Promise<Map<string, CliSection>> {
	const dirs = process.argv
		.filter((arg) => arg.startsWith("--commands="))
		.flatMap((arg) => arg.slice("--commands=".length).split(","));

	const sections = new Map<string, CliSection>();
	for (const dir of dirs) {
		const absDir = resolve(dir);
		for (const file of readdirSync(absDir)) {
			if (!file.endsWith(".ts") || file === "index.ts") continue;
			const name = basename(file, ".ts");
			if (name === "assistant" || sections.has(name)) continue;
			try {
				const mod = await import(pathToFileURL(resolve(absDir, file)).href);
				const factory = mod.default ?? mod;
				if (typeof factory === "function") sections.set(name, factory());
			} catch {
				// A section with a missing dependency is skipped, exactly as the
				// CLI listing skips it — the rest of the catalog still stands.
			}
		}
	}
	return sections;
}

/** Publishes the command map into the catalog store as the CLI's own group. */
export function publishCliCatalog(
	catalog: ConversationCatalog,
	sections: Map<string, CliSection>,
): FunctionBrief[] {
	const functions = [...sections].flatMap(([section, processor]) =>
		(processor.catalog ?? []).map(({ command, description }) => ({
			id: `${section}.${command}`,
			brief: description,
			category: section,
		})),
	);

	catalog.sourceRegistered({
		id: "cli",
		group: "backend",
		meta: (id) => {
			const entry = functions.find((candidate) => candidate.id === id);
			if (!entry) return undefined;
			// CLI commands take one free-form string, the one typed after the
			// command name — that is the whole argument schema here.
			return {
				...entry,
				description: entry.brief,
				parameters: {
					type: "object" as const,
					properties: {
						param: {
							type: "string",
							description:
								"Everything typed after the command name; omit when the command takes nothing",
						},
					},
				},
			};
		},
		invoke: async (id, args) => {
			const [section, command] = id.split(".", 2);
			const processor = section ? sections.get(section) : undefined;
			if (!processor || !command) throw new Error(`Unknown command: ${id}`);
			const param = typeof args.param === "string" ? args.param : undefined;

			// CLI commands print their result instead of returning it, so the fact
			// is what they printed — otherwise the answer step has nothing to talk
			// about and starts asking the user to paste the output back.
			const printed: string[] = [];
			const original = console.log;
			console.log = (...parts: unknown[]) => {
				const line = parts
					.map((part) => (typeof part === "string" ? part : Bun.inspect(part)))
					// The commands colour their output; the model does not need escapes.
					.join(" ")
					.replace(/\x1b\[[0-9;]*m/g, "");
				printed.push(line);
				original(...(parts as []));
			};
			const startedAt = performance.now();
			try {
				await processor.processCommand(command, param);
			} finally {
				console.log = original;
			}
			original(formatElapsed(`${id} data`, performance.now() - startedAt));
			return { ok: true, ran: id, param, output: printed.join("\n") };
		},
	});
	catalog.functionsPublished({ source: "cli", functions });
	return functions;
}

// Step instructions are sections of the same rp-contexts record the chat uses:
// one read at startup, so a missing record or a missing section is an error
// before the first message, not a silent plain chat.
async function loadStepPrompts(
	contextName: string,
	language: string | undefined,
): Promise<Map<string, string>> {
	const reply = await cliWebSocketChannel.request({
		kind: "request",
		requestId: crypto.randomUUID(),
		to: { target: "services", service: "contexts" },
		method: "getContext",
		codec: "json",
		deadlineMs: 20_000,
		payload: { name: contextName, language },
	} as WebSocketRequestMessage);

	const data = (reply.payload as { data?: Record<string, unknown> } | undefined)
		?.data;
	if (!data || typeof data !== "object") {
		throw new Error(
			`Context "${contextName}"${language ? ` (${language})` : ""} not found in rp-contexts`,
		);
	}

	const prompts = new Map<string, string>();
	for (const [step, section] of Object.entries(data)) {
		const text =
			typeof section === "string"
				? section
				: (section as { prompt?: unknown })?.prompt;
		if (typeof text === "string" && text.trim()) prompts.set(step, text.trim());
	}

	const missing = ["route", "select", "args"].filter(
		(step) => !prompts.has(step),
	);
	if (missing.length > 0) {
		throw new Error(
			`Context "${contextName}" has no ${missing.join(" / ")} section${missing.length > 1 ? "s" : ""}: ` +
				`the orchestrator steps have no instructions. Sections present: ${[...prompts.keys()].join(", ") || "none"}`,
		);
	}
	return prompts;
}

/** The Fujin socket, in the envelope shape the shared transport expects. */
const envelopeChannel: EnvelopeChannel = {
	requestEnvelope: (message: CommandEnvelope) =>
		cliWebSocketChannel.request(message as WebSocketRequestMessage),
	requestEnvelopeStream: (message: CommandEnvelope) =>
		cliWebSocketChannel.requestStream(message as WebSocketRequestMessage),
};

/**
 * The console as a view over the stores: nothing here keeps state, it prints
 * what the conversation records. Static fields are read from the entry, changed
 * ones come from the patch — so it never depends on update ordering.
 */
function renderToConsole(conversation: Conversation): void {
	const { entries } = conversation;
	let streamingId: string | undefined;
	let turnStartedAt = 0;
	let firstTokenMs: number | undefined;

	conversation.turn.turnStarted.watch(() => {
		turnStartedAt = performance.now();
		firstTokenMs = undefined;
	});

	entries.appended.watch((entry) => {
		if (entry.kind !== "call" || entry.status !== "running") return;
		const param = entry.args.param;
		console.log(
			dim(`[${entry.name}${typeof param === "string" && param ? ` ${param}` : ""}]`),
		);
	});

	entries.textAppended.watch(({ id, delta }) => {
		if (streamingId !== id) {
			streamingId = id;
			firstTokenMs ??= performance.now() - turnStartedAt;
			process.stdout.write("\nai> ");
		}
		process.stdout.write(delta);
	});

	entries.patched.watch(({ id, patch }) => {
		const entry = entries.read(id);
		if (!entry) return;

		if (entry.kind === "step" && patch.status) {
			console.log(
				dim(
					`[${entry.step} ${patch.elapsedMs}ms ${entry.tier}] ${patch.outcome ?? ""}`,
				),
			);
			return;
		}

		if (entry.kind === "call" && patch.status && patch.status !== "running") {
			if (patch.error) console.log(dim(`[${entry.name} failed: ${patch.error}]`));
			return;
		}

		if (entry.kind === "assistant" && patch.streaming === false) {
			if (streamingId === id) {
				process.stdout.write("\n\n");
				streamingId = undefined;
			}
			const elapsed = performance.now() - turnStartedAt;
			const parts = [`${Math.round(elapsed)}ms`];
			if (firstTokenMs !== undefined) parts.push(`first ${Math.round(firstTokenMs)}ms`);
			const tokens = patch.tokens;
			if (typeof tokens === "number") {
				parts.push(
					`${tokens} tokens`,
					`${(tokens / (elapsed / 1000)).toFixed(1)} tok/s`,
				);
			}
			if (patch.finishReason) parts.push(String(patch.finishReason));
			console.log(dim(`[${parts.join(", ")}]`));
		}
	});

	conversation.failed.watch((message) => console.error(`Error: ${message}`));
}

const chatHandler: Handler = async (_client, _splitter, param) => {
	// `assistant chat` collides with the context that is also called "chat", so
	// the name can be given either way: `assistant chat --context=chat` or
	// `assistant <context>`.
	const raw = param?.trim() ?? "";
	const contextName =
		(raw.startsWith("--context=")
			? raw.slice("--context=".length)
			: raw
		).trim() ||
		process.env.ASSISTANT_CONTEXT?.trim() ||
		CHAT_CONTEXT;
	const config: ChatConfig = {
		contextName,
		provider: process.env.ASSISTANT_PROVIDER?.trim() || undefined,
		model:
			process.env.ASSISTANT_MODEL?.trim() ||
			process.env.OPENAI_MODEL?.trim() ||
			undefined,
		language: process.env.ASSISTANT_LANGUAGE?.trim() || undefined,
		endpoint: process.env.ASSISTANT_ENDPOINT?.trim() || "fast",
	};

	const transport = createResonusCommandTransport(envelopeChannel, {
		deadlineMs: CHAT_DEADLINE_MS,
	});
	const session = createResonusSession({
		transport,
		endpoint: config.endpoint,
	});

	const sections = await loadSections();
	const prompts = await loadStepPrompts(contextName, config.language);

	const conversation = createConversation({
		ask: session.ask,
		prompt: async (step) => prompts.get(step),
		driver: createResonusChatDriver({
			transport,
			sessionId: session.sessionId,
			provider: config.provider,
			model: config.model,
			contextName: config.contextName,
			language: config.language,
		}),
		model: config.endpoint,
	});

	const functions = publishCliCatalog(conversation.catalog, sections);
	renderToConsole(conversation);

	const summary = Object.entries(config)
		.filter(([, value]) => value)
		.map(([key, value]) => `${key}=${value}`)
		.join(", ");
	console.log(
		`session ${session.sessionId}${summary ? ` (${summary})` : ""}, endpoint=${config.endpoint}`,
	);
	console.log(
		`catalog: ${functions.length} commands in ${sections.size} sections`,
	);
	console.log(
		`steps: ${[...prompts.keys()].join(" → ")} (context "${contextName}")`,
	);
	console.log("Type a message, /exit to quit\n");

	await session.start();
	try {
		process.stdout.write("you> ");
		for await (const line of console) {
			const text = line.trim();
			if (text === "/exit" || text === "/quit") break;
			// Errors reach the console through `conversation.failed`: the turn
			// records its own failure instead of throwing out of the loop.
			if (text) await conversation.send(text);
			process.stdout.write("you> ");
		}
	} finally {
		await session.close().catch(() => {});
	}
};

class AssistantProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"chat",
				{
					handler: chatHandler,
					description:
						"Interactive AI chat over the Fujin WebSocket (param: context name)",
				},
			],
		]);
	}

	// Support `bun cli assistant [contextname]`: no subcommand (or an unknown
	// one) starts the chat, treating the argument as the context name.
	override async processCommand(
		command: string,
		param?: string,
	): Promise<void> {
		if (!command || !this.commandMap.has(command)) {
			const context = [command, param].filter(Boolean).join(" ");
			return super.processCommand("chat", context || undefined);
		}
		return super.processCommand(command, param);
	}
}

export default () => new AssistantProcessor(null);
