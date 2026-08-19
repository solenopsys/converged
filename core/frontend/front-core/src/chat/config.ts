

export type ChatConfig = {

	fujinWsUrl: string;

	cacheBaseUrl: string;

	storageScope: string;

	contextName: string;

	callContextName: string;

	language: string;

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
