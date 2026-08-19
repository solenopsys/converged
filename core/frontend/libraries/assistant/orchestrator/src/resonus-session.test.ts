import { describe, expect, test } from "bun:test";
import {
	createResonusSession,
	type ResonusCommandTransport,
} from "./resonus-session";

type Command = { method: string; payload: Record<string, unknown> };

function transport(events: unknown[] = []): {
	transport: ResonusCommandTransport;
	commands: Command[];
	streams: Command[];
} {
	const commands: Command[] = [];
	const streams: Command[] = [];
	return {
		transport: {
			command: async (method, payload) => {
				commands.push({ method, payload });
			},
			stream: async function* (method, payload) {
				streams.push({ method, payload });
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
