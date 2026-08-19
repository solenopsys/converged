// route/select/args answer with structure, but a model produces it: light
// models wrap JSON in fences and add prose around it. undefined means "the step
// did not answer with structure" — the caller picks its own fallback.

const FENCE = /```(?:json)?\s*([\s\S]*?)```/i;


function firstObject(text: string): string | undefined {
	const start = text.indexOf("{");
	if (start === -1) return undefined;

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const char = text[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === "\\") {
			escaped = true;
			continue;
		}
		if (char === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (char === "{") depth++;
		else if (char === "}" && --depth === 0) return text.slice(start, i + 1);
	}
	return undefined;
}

export function parseJsonObject(text: string): Record<string, unknown> | undefined {
	const candidates = [text.match(FENCE)?.[1], text, firstObject(text)];
	for (const candidate of candidates) {
		if (!candidate?.trim()) continue;
		try {
			const parsed = JSON.parse(candidate.trim()) as unknown;
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		} catch {
			// Try the next candidate: an unclosed fence, a trailing sentence.
		}
	}
	return undefined;
}

export function readString(
	source: Record<string, unknown> | undefined,
	key: string,
): string | undefined {
	const value = source?.[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
