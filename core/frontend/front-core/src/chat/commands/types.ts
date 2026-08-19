export type SlashHandler = (
	param: string | undefined,
) => Promise<string> | string;

export type SlashCommand = {
	handler: SlashHandler;
	description: string;
};

export type SlashSection = {
	name: string;
	description: string;

	commands?: Record<string, SlashCommand>;

	fallback?: SlashHandler;
};
