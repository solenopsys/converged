import type { ContextsService } from "g-contexts";



type SectionShape = { prompt?: unknown };

function textOf(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() || undefined;
	if (value && typeof value === "object") {
		const { prompt } = value as SectionShape;
		if (typeof prompt === "string") return prompt.trim() || undefined;
	}
	return undefined;
}

export type ContextPromptOptions = {

	section?: string;

	requireSection?: boolean;
};

export function createContextPromptResolver(
	contexts: Pick<ContextsService, "getContext">,
	options: ContextPromptOptions = {},
) {
	const cache = new Map<string, Promise<string | undefined>>();

	return async ({
		contextName,
		language,
	}: {
		contextName?: string;
		language?: string;
	}): Promise<string | undefined> => {
		if (!contextName) return undefined;

		const key = `${language ?? ""}/${contextName}#${options.section ?? ""}`;
		let pending = cache.get(key);
		if (!pending) {
			pending = contexts
				.getContext(contextName, language)
				.then((context) => {
					if (!context) return undefined;
					const { data } = context;
					if (options.section) {
						const section =
							data && typeof data === "object"
								? textOf((data as Record<string, unknown>)[options.section])
								: undefined;
						if (section || options.requireSection) return section;
					}
					return textOf(data);
				})
				.catch((error) => {
					cache.delete(key);
					const message = error instanceof Error ? error.message : String(error);
					throw new Error(`[chat] Context "${key}" unavailable: ${message}`);
				});
			cache.set(key, pending);
		}
		return pending;
	};
}
