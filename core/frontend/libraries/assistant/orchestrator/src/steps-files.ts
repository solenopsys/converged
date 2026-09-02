import type { PlanContext, Step, StepAnswer, ToolSpec } from "./types";

// The files module: an optional step for a turn that carries files.
//
// It exists because files break the assumption the built-in flow is built on.
// route → search → select reads the user's words to find a function, and args
// asks a model to copy values out of the same words. Files are not words: after
// an archive is unpacked the turn holds a dozen identifiers no one typed, and
// asking a light model to transcribe them into an object is a round-trip that
// costs money and quietly returns nothing — which is how a request gets created
// with no files on it and is reported as done.
//
// So the split is: the model decides *what these files are for*, once, from
// their names and types; the identifiers are filled by the host, which has had
// them all along. When the host can fill the whole call, `args` is skipped too,
// and the turn costs one request instead of three.
//
// The module is domain-free. What an intent means — which catalog function it
// runs, how files become an argument — is configuration the host supplies, and
// the wording that decides between intents is a `files` section in ms-contexts,
// like every other step's prompt. Without that section the step asks nothing
// and the turn falls through to the ordinary flow.

/** One file the current turn is about. */
export type TurnFile = {
	fileId: string;
	name: string;
	fileType?: string;
	/** The host's mark for what the domain acts on — a production model, say. */
	primary?: boolean;
};

export type FilesIntent = {
	/** Catalog id this intent runs. */
	id: string;
	/** What choosing it means, in the model's words. */
	brief: string;
	/** Arguments the host fills itself, identifiers included. */
	arguments?: (files: TurnFile[]) => Record<string, unknown>;
	/** `arguments` is the whole call — do not spend a step asking for more. */
	complete?: boolean;
};

export type FilesStepOptions = {
	/** The files of the turn, newest first; empty means the step stands aside. */
	files: () => TurnFile[];
	/** Intent name (what the model answers) -> what it runs. */
	intents: Record<string, FilesIntent>;
	/** Overrides the step name, and with it the ms-contexts section it reads. */
	name?: string;
};

const NONE = "none";

const line = (file: TurnFile): string =>
	[
		file.name,
		file.fileType ? ` (${file.fileType})` : "",
		file.primary ? " *" : "",
	].join("");

function chosen(
	answer: StepAnswer | undefined,
	tool: string,
): string | undefined {
	const call = answer?.toolCalls.find((candidate) => candidate.name === tool);
	const intent = call?.args.intent;
	return typeof intent === "string" ? intent : undefined;
}

export function createFilesStep({
	files,
	intents,
	name = "files",
}: FilesStepOptions): Step<PlanContext> {
	const names = Object.keys(intents);

	const tool: ToolSpec = {
		name,
		description: "Say what the files attached to this turn are for.",
		parameters: {
			type: "object",
			properties: {
				intent: {
					type: "string",
					enum: [...names, NONE],
					description: [
						...names.map((key) => `"${key}" — ${intents[key]?.brief}`),
						`"${NONE}" — the files need no action of their own`,
					].join("; "),
				},
			},
			required: ["intent"],
		},
	};

	return {
		name,
		// No files, no decision. The rest of the table is untouched by this
		// module's existence, which is what keeps it optional.
		when: () => files().length > 0,
		tools: () => [tool],
		// Names and types are what the decision is about. The identifiers are
		// deliberately absent: they are long, they are half the prompt, and the
		// model is not the one who will be copying them.
		ask: (context) => {
			const listed = files()
				.map((file) => `- ${line(file)}`)
				.join("\n");
			return [
				`Files in this turn (* marks what the application can act on):\n${listed}`,
				`User: ${context.userText}`,
			].join("\n\n");
		},
		apply: (_context, answer) => {
			// No prompt section, no answer, or "none": the turn carries on through
			// the ordinary flow, which is exactly what happened before this module
			// was added.
			const intent = chosen(answer, name);
			if (!intent || intent === NONE) return {};
			const target = intents[intent];
			if (!target) return {};

			const known = target.arguments?.(files()) ?? {};
			return {
				patch: {
					id: target.id,
					known,
					argumentsFinal: target.complete === true,
				},
			};
		},
	};
}
