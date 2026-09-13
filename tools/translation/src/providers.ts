/**
 * The translation API behind `--translate`.
 *
 * Batching, retries and the store do not care which vendor answers, but the
 * endpoint, the auth header and the envelope do. This module is that
 * difference, so `translate.ts` stays about documents.
 *
 * `openai` (the default) speaks the Responses API. `openrouter` speaks the
 * OpenAI-compatible chat completions endpoint, which puts many model vendors
 * behind one key — useful when the best model for a locale is not an OpenAI
 * one, or when a rate limit on one vendor should not stop the run.
 */

import type { Job } from "./queue";

export type ProviderName = "openai" | "openrouter";

type Json = Record<string, unknown>;

export type ResolvedProvider = {
	name: ProviderName;
	/** Human-readable, for the run log. */
	label: string;
	/** Full request URL. */
	endpoint: string;
	model: string;
	headers: Record<string, string>;
	/** Request body for one batch of jobs and the shared instructions. */
	body: (jobs: Job[], instructions: string) => unknown;
	/** The model's answer text, from whichever envelope the provider uses. */
	outputText: (response: Json) => string;
};

/** The JSON both providers are asked to return. */
const TRANSLATION_SCHEMA = {
	type: "object",
	properties: {
		items: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string" },
					translation: { type: "string" },
				},
				required: ["id", "translation"],
				additionalProperties: false,
			},
		},
	},
	required: ["items"],
	additionalProperties: false,
} as const;

function batchInput(jobs: Job[]): string {
	return JSON.stringify({
		items: jobs.map(({ id, type, content }) => ({ id, type, content })),
	});
}

function cleanBase(value: string | undefined, fallback: string): string {
	const trimmed = value?.trim();
	return (trimmed || fallback).replace(/\/+$/, "");
}

function errorMessage(body: Json, fallback: string): string {
	const error = body.error as { message?: string } | undefined;
	return error?.message ?? fallback;
}

function openaiOutputText(body: Json): string {
	if (typeof body.output_text === "string") return body.output_text;
	const output = body.output as
		| Array<{ content?: Array<{ type?: string; text?: string }> }>
		| undefined;
	for (const item of output ?? []) {
		for (const content of item.content ?? []) {
			if (content.type === "output_text" && content.text) return content.text;
		}
	}
	throw new Error(errorMessage(body, "OpenAI response has no output text"));
}

function openrouterOutputText(body: Json): string {
	const choices = body.choices as
		| Array<{
				message?: {
					content?: string | Array<{ type?: string; text?: string }>;
				};
		  }>
		| undefined;
	const content = choices?.[0]?.message?.content;
	if (typeof content === "string" && content) return content;
	if (Array.isArray(content)) {
		const text = content.map((part) => part.text ?? "").join("");
		if (text) return text;
	}
	throw new Error(errorMessage(body, "OpenRouter response has no output text"));
}

/**
 * Which provider a run uses, from the environment.
 *
 * `DOCS_TRANSLATION_PROVIDER` selects it (default `openai`);
 * `DOCS_TRANSLATION_MODEL` names the model for either. Each provider reads its
 * own key so both can sit in one env file and a run only spends the one it
 * asked for.
 */
export function resolveProvider(env = process.env): ResolvedProvider {
	const name = (env.DOCS_TRANSLATION_PROVIDER?.trim() ||
		"openai") as ProviderName;
	const model = env.DOCS_TRANSLATION_MODEL?.trim();
	if (!model) {
		throw new Error("DOCS_TRANSLATION_MODEL is required for build:doc -t");
	}

	if (name === "openrouter") {
		const apiKey = env.OPENROUTER_API_KEY?.trim();
		if (!apiKey) {
			throw new Error(
				"OPENROUTER_API_KEY is required when DOCS_TRANSLATION_PROVIDER=openrouter",
			);
		}
		const base = cleanBase(
			env.OPENROUTER_BASE_URL,
			"https://openrouter.ai/api/v1",
		);
		return {
			name,
			label: "OpenRouter",
			endpoint: `${base}/chat/completions`,
			model,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				...(env.OPENROUTER_REFERER
					? { "HTTP-Referer": env.OPENROUTER_REFERER }
					: {}),
				...(env.OPENROUTER_TITLE ? { "X-Title": env.OPENROUTER_TITLE } : {}),
			},
			body: (jobs, instructions) => ({
				model,
				messages: [
					{ role: "system", content: instructions },
					{ role: "user", content: batchInput(jobs) },
				],
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "document_translations",
						strict: true,
						schema: TRANSLATION_SCHEMA,
					},
				},
			}),
			outputText: openrouterOutputText,
		};
	}

	if (name !== "openai") {
		throw new Error(
			`Unknown DOCS_TRANSLATION_PROVIDER: ${name} (expected openai or openrouter)`,
		);
	}

	const apiKey = env.OPENAI_API_KEY?.trim();
	if (!apiKey) throw new Error("OPENAI_API_KEY is required for build:doc -t");
	const base = cleanBase(env.OPENAI_BASE_URL, "https://api.openai.com/v1");
	return {
		name,
		label: "OpenAI",
		endpoint: `${base}/responses`,
		model,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: (jobs, instructions) => ({
			model,
			store: false,
			instructions,
			input: batchInput(jobs),
			text: {
				format: {
					type: "json_schema",
					name: "document_translations",
					strict: true,
					schema: TRANSLATION_SCHEMA,
				},
			},
		}),
		outputText: openaiOutputText,
	};
}
