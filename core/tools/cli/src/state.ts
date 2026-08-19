import { createDomain, type Store } from "effector";

// CLI state as a model, not as scattered flags: who we are, what is running and
// how it ended. Every command goes through here, so a single logger sees the
// whole run, and an expired session is a state the CLI reports — not a stack
// trace out of a socket handler.

export const cliDomain = createDomain("cli");

export type SessionSource = "session-file" | "service-token" | "none";
export type SessionStatus = "unknown" | "anonymous" | "authenticated" | "rejected";

export type CliSession = {
	status: SessionStatus;
	source: SessionSource;
	/** The stored JWT existed and was refused, so it was dropped mid-run. */
	discarded: boolean;
	/** Why the gateway refused, when it did. */
	reason?: string;
	code?: string;
};

export type CommandRequest = {
	section: string;
	command?: string;
	param?: string;
};

export type CommandState = CommandRequest & {
	status: "idle" | "running" | "done" | "failed";
	elapsedMs?: number;
	error?: string;
};

export const sessionDetected = cliDomain.createEvent<{
	source: SessionSource;
}>("SESSION_DETECTED");
export const authGranted = cliDomain.createEvent<void>("AUTH_GRANTED");
export const authRejected = cliDomain.createEvent<{
	reason: string;
	code?: string;
}>("AUTH_REJECTED");
/** The stored JWT was refused, so it is dropped before the retry. */
export const sessionDiscarded = cliDomain.createEvent<void>("SESSION_DISCARDED");

export const commandRequested = cliDomain.createEvent<CommandRequest>(
	"COMMAND_REQUESTED",
);
export const commandSucceeded = cliDomain.createEvent<{ elapsedMs: number }>(
	"COMMAND_SUCCEEDED",
);
export const commandFailed = cliDomain.createEvent<{
	message: string;
	elapsedMs: number;
}>("COMMAND_FAILED");

export const $session: Store<CliSession> = cliDomain
	.createStore<CliSession>(
		{ status: "unknown", source: "none", discarded: false },
		{ name: "SESSION" },
	)
	.on(sessionDetected, (session, { source }) => ({
		...session,
		source,
		status: source === "none" ? "anonymous" : session.status,
	}))
	.on(authGranted, (session) => ({ ...session, status: "authenticated" }))
	.on(authRejected, (session, { reason, code }) => ({
		...session,
		status: "rejected",
		reason,
		code,
	}))
	.on(sessionDiscarded, (session) => ({ ...session, discarded: true }));

export const $command: Store<CommandState> = cliDomain
	.createStore<CommandState>(
		{ section: "", status: "idle" },
		{ name: "COMMAND" },
	)
	.on(commandRequested, (_, request) => ({ ...request, status: "running" }))
	.on(commandSucceeded, (state, { elapsedMs }) => ({
		...state,
		status: "done",
		elapsedMs,
	}))
	.on(commandFailed, (state, { message, elapsedMs }) => ({
		...state,
		status: "failed",
		elapsedMs,
		error: message,
	}));

/**
 * Every unit of the domain, printed when asked. The point of routing commands
 * through the model: one switch turns on a trace of the whole run.
 */
export function attachCliLogger(enabled: boolean): void {
	if (!enabled) return;
	const at = () => new Date().toISOString().slice(11, 23);
	const trace = (name: string, payload: unknown) =>
		console.error(
			`\x1b[2m[cli ${at()}] ${name}${
				payload === undefined ? "" : ` ${Bun.inspect(payload)}`
			}\x1b[0m`,
		);

	// Subscribed by name rather than through the domain hooks: those only see
	// units created after they are installed, and these exist at import time.
	const units = {
		sessionDetected,
		authGranted,
		authRejected,
		sessionDiscarded,
		commandRequested,
		commandSucceeded,
		commandFailed,
	};
	for (const [name, unit] of Object.entries(units)) {
		unit.watch((payload: unknown) => trace(name, payload));
	}
}
