import { describe, expect, test } from "bun:test";
import {
	createResonusSession,
	type ResonusCommandTransport,
} from "./resonus-session";

type Command = { method: string; payload: Record<string, unknown> };

type FakeOptions = {
	/** Rejects the listed `llm.generate` attempts (0-based) with this reason. */
	failStream?: { at: number[]; reason: string };
	/** Rejects every command with this method until the session re-opens. */
	failCommand?: { method: string; reason: string; times: number };
};

function transport(
	events: unknown[] = [],
	options: FakeOptions = {},
): {
	transport: ResonusCommandTransport;
	commands: Command[];
	streams: Command[];
} {
	const commands: Command[] = [];
	const streams: Command[] = [];
	let failuresLeft = options.failCommand?.times ?? 0;
	return {
		transport: {
			command: async (method, payload) => {
				commands.push({ method, payload });
				if (options.failCommand?.method === method && failuresLeft > 0) {
					failuresLeft -= 1;
					throw new Error(options.failCommand.reason);
				}
			},
			stream: async function* (method, payload) {
				const attempt = streams.length;
				streams.push({ method, payload });
				if (options.failStream?.at.includes(attempt)) {
					throw new Error(options.failStream.reason);
				}
				for (const event of events) yield event;
			},
		},
		commands,
		streams,
	};
}

const input = {
	step: "route",
	system: "route instruction",
	user: "list cron jobs",
	tier: "fast",
	tools: [],
};

describe("Resonus session adapter", () => {
	test("reuses one session binding while isolating every step context", async () => {
		const fake = transport([
			{ type: "tool_call.ready", name: "route", arguments: { area: "cron" } },
		]);
		const session = createResonusSession({
			transport: fake.transport,
			sessionId: "session-1",
		});

		await session.ask(input);
		const second = await session.ask(input);

		expect(second.toolCalls).toEqual([
			{ name: "route", args: { area: "cron" } },
		]);
		expect(
			fake.commands.filter(({ method }) => method === "session.open"),
		).toHaveLength(1);
		expect(
			fake.commands.filter(
				({ method, payload }) =>
					method === "session.bind" && payload.endpoint === "fast",
			),
		).toHaveLength(1);
		expect(
			fake.commands.filter(({ method }) => method === "context.create"),
		).toHaveLength(2);
		expect(
			fake.commands.filter(({ method }) => method === "context.delete"),
		).toHaveLength(2);
		expect(fake.streams).toHaveLength(2);
		expect(
			fake.streams.every(({ payload }) => payload.sessionId === "session-1"),
		).toBe(true);
	});

	test("adds a binding only when a step selects another endpoint", async () => {
		const fake = transport();
		const session = createResonusSession({
			transport: fake.transport,
			sessionId: "session-2",
		});

		await session.ask(input);
		await session.ask({ ...input, tier: "heavy" });

		expect(
			fake.commands
				.filter(({ method }) => method === "session.bind")
				.map(({ payload }) => payload.endpoint),
		).toEqual(["fast", "heavy"]);
	});

	test("deduplicates repeated ready events for the same tool call", async () => {
		const fake = transport([
			{
				type: "tool_call.ready",
				name: "call",
				arguments: { to: "a@example.com" },
			},
			{
				type: "tool_call.ready",
				name: "call",
				arguments: { to: "a@example.com" },
			},
		]);
		const session = createResonusSession({ transport: fake.transport });

		expect(await session.ask(input)).toMatchObject({
			toolCalls: [{ name: "call", args: { to: "a@example.com" } }],
		});
	});

	test("re-opens and retries once when the server forgot the session", async () => {
		const fake = transport([{ type: "text.delta", text: "ok" }], {
			failStream: { at: [0], reason: "SessionUnknown" },
		});
		const session = createResonusSession({
			transport: fake.transport,
			sessionId: "session-4",
		});

		expect(await session.ask(input)).toMatchObject({ text: "ok" });
		// The lost session is opened and bound again — skipping the rebind
		// would only trade SessionUnknown for EndpointNotBound.
		expect(
			fake.commands.filter(({ method }) => method === "session.open"),
		).toHaveLength(2);
		expect(
			fake.commands.filter(({ method }) => method === "session.bind"),
		).toHaveLength(2);
		expect(fake.streams).toHaveLength(2);
	});

	test("recovers from an endpoint the server no longer has bound", async () => {
		const fake = transport([{ type: "text.delta", text: "ok" }], {
			failStream: { at: [0], reason: "EndpointNotBound" },
		});
		const session = createResonusSession({ transport: fake.transport });

		expect(await session.ask(input)).toMatchObject({ text: "ok" });
	});

	test("retries a lost session once, then reports it", async () => {
		const fake = transport([], {
			failStream: { at: [0, 1], reason: "SessionUnknown" },
		});
		const session = createResonusSession({ transport: fake.transport });

		// A server that keeps forgetting is a real failure, not a turn to keep
		// replaying: the host has to hear about it.
		await expect(session.ask(input)).rejects.toThrow("SessionUnknown");
		expect(fake.streams).toHaveLength(2);
	});

	test("a failed open is not remembered as the session state", async () => {
		const fake = transport([{ type: "text.delta", text: "ok" }], {
			failCommand: {
				method: "session.open",
				reason: "Signal connection was interrupted",
				times: 1,
			},
		});
		const session = createResonusSession({
			transport: fake.transport,
			sessionId: "session-5",
		});

		await expect(session.ask(input)).rejects.toThrow(
			"Signal connection was interrupted",
		);
		// Without clearing the memoized promise this second turn would replay
		// the first failure for as long as the page lives.
		expect(await session.ask(input)).toMatchObject({ text: "ok" });
	});

	test("closing a session the server forgot is not an error", async () => {
		const fake = transport([], {
			failCommand: {
				method: "session.close",
				reason: "SessionUnknown",
				times: 1,
			},
		});
		const session = createResonusSession({ transport: fake.transport });

		await session.start();
		await session.close();
	});

	test("releases a context when generation fails", async () => {
		const fake = transport([
			{ type: "response.error", message: "vendor rejected request" },
		]);
		const session = createResonusSession({
			transport: fake.transport,
			sessionId: "session-3",
		});

		await expect(session.ask(input)).rejects.toThrow("vendor rejected request");
		expect(fake.commands.at(-1)).toMatchObject({
			method: "context.delete",
		});
	});
});
