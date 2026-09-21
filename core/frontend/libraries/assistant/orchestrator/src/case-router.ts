import type { ResonusCommandTransport } from "./resonus-session";
import type { CaseContext } from "./case-context";

export type CaseDecision = {
	command: string;
};

/** A fast command router. `undefined` means that normal conversational fallback should answer. */
export type CaseRouter = {
	route(text: string): Promise<CaseDecision | undefined>;
};

export type ResonusCaseRouterOptions = {
	transport: ResonusCommandTransport;
	context: string;
	language?: string;
};

type CaseReply = {
	toolCalls?: Array<{ name?: unknown }>;
};

/** Uploads one compact, language-filtered context through the Resonus nRPC API. */
export async function loadResonusCaseContext(
	transport: ResonusCommandTransport,
	context: CaseContext,
): Promise<void> {
	await transport.request("provider.complete", {
		provider: "case",
		model: "case",
		maxTokens: 1,
		messages: [],
		operation: "context.load",
		input: context,
	});
}

/**
 * CASE is exposed by Resonus over nRPC. Its provider response is uniform, so
 * the adapter only admits its first non-empty tool-call name as a command id.
 */
export function createResonusCaseRouter({
	transport,
	context,
	language,
}: ResonusCaseRouterOptions): CaseRouter {
	return {
		async route(text): Promise<CaseDecision | undefined> {
			const reply = (await transport.request("provider.complete", {
				provider: "case",
				model: "case",
				maxTokens: 1,
				messages: [{ role: "user", content: text }],
				input: {
					context,
					...(language ? { language } : {}),
				},
			})) as CaseReply;
			const command = reply.toolCalls?.find(
				(call): call is { name: string } =>
					typeof call.name === "string" && call.name.length > 0,
			)?.name;
			return command ? { command } : undefined;
		},
	};
}
