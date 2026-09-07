import {
	$session,
	authGranted,
	authRejected,
	cliDomain,
	commandFailed,
	commandRequested,
	commandSucceeded,
	sessionDetected,
	sessionDiscarded,
	type CommandRequest,
	type SessionSource,
} from "./state";
import { formatElapsed } from "./timing";
import { CliAuthError, cliWebSocketChannel, setCliSessionJwt } from "./ws";

// Running one command as a small state machine: know who we are, connect, run,
// report. Failure modes end as printed guidance and an exit code — never as an
// unhandled rejection out of a socket callback.

export type CliProcessor = {
	commands?: string[];
	needsChannel?: boolean;
	processCommand(command: string, param?: string): Promise<void>;
};

export type RunOptions = CommandRequest & {
	processor: CliProcessor;
	/** The stored login JWT, when there is one. */
	sessionToken?: string;
};

const LOGIN_HINT = "Sign in again: bun cli auth login <magic-link>";

export const connectFx = cliDomain.createEffect(
	async (sessionToken: string | undefined): Promise<void> => {
		try {
			await cliWebSocketChannel.connect();
		} catch (error) {
			if (!(error instanceof CliAuthError) || !error.recoverable) throw error;

			// The stored session is what Fujin refused. Drop it and try once more on
			// the service token, so a command that does not actually need the user
			// identity still runs instead of dying on a stale file.
			setCliSessionJwt(undefined);
			sessionDiscarded();
			try {
				await cliWebSocketChannel.connect();
			} catch (retry) {
				throw retry instanceof CliAuthError ? retry : error;
			}
			authRejected({
				reason: "the stored session was refused; continuing without it",
				code: error.code,
			});
			return;
		}
		authGranted();
	},
	{ name: "CONNECT_FX" },
);

export const runCommandFx = cliDomain.createEffect(
	async ({
		processor,
		command,
		param,
	}: Pick<RunOptions, "processor" | "command" | "param">): Promise<void> => {
		await processor.processCommand(command ?? "", param);
	},
	{ name: "RUN_COMMAND_FX" },
);

function reportAuthFailure(error: CliAuthError): void {
	console.error(
		$session.getState().discarded || error.code !== "no-token"
			? "CLI session expired or rejected."
			: "Not signed in.",
	);
	console.error(LOGIN_HINT);
}

/** Detects who we are before anything connects, so state is never implicit. */
export function detectSession(sessionToken?: string): SessionSource {
	const source: SessionSource = sessionToken
		? "session-file"
		: process.env.SERVICE_TOKEN?.trim()
			? "service-token"
			: "none";
	sessionDetected({ source });
	return source;
}

export async function runCli({
	section,
	command,
	param,
	processor,
	sessionToken,
}: RunOptions): Promise<number> {
	const needsChannel = processor.needsChannel !== false;
	const startedAt = performance.now();

	commandRequested({ section, command, param });
	detectSession(sessionToken);

	try {
		if (needsChannel) await connectFx(sessionToken);
		await runCommandFx({ processor, command, param });

		const elapsedMs = performance.now() - startedAt;
		commandSucceeded({ elapsedMs });
		console.log(
			formatElapsed(`cli ${section}${command ? ` ${command}` : ""}`, elapsedMs),
		);
		return 0;
	} catch (error) {
		const elapsedMs = performance.now() - startedAt;
		const message = error instanceof Error ? error.message : String(error);
		commandFailed({ message, elapsedMs });

		if (error instanceof CliAuthError) {
			authRejected({ reason: message, code: error.code });
			reportAuthFailure(error);
		} else {
			console.error(`Error: ${message}`);
		}
		return 1;
	} finally {
		if (needsChannel) cliWebSocketChannel.close();
	}
}
