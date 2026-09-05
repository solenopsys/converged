export type ChatConfig = {
	fujinWsUrl: string;

	cacheBaseUrl: string;

	storageScope: string;

	contextName: string;

	callContextName: string;

	language: string;

	/**
	 * Fall back to the old function flow (route → search → select → args)
	 * instead of the surface flow. An escape hatch for a delivery whose chat
	 * context has no `surface` and `action` sections yet: a deciding step with
	 * no instructions decides nothing, and every turn ends as a plain answer.
	 */
	functionFlow?: boolean;

	createWorker: () => Worker;
};

export const requireValue = (
	value: string | undefined | null,
	name: string,
): string => {
	const trimmed = value?.trim();
	if (!trimmed) throw new Error(`[chat] missing required ${name}`);
	return trimmed;
};
