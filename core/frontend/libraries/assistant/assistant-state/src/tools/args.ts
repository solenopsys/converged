
export const parseToolArgs = <T extends Record<string, any>>(
	args: T | string | undefined,
): T => {
	if (!args) return {} as T;
	if (typeof args !== "string") return args;

	try {
		return JSON.parse(args) as T;
	} catch {
		return {} as T;
	}
};
