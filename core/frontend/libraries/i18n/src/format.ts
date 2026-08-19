export type MessageParams = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

// Unknown placeholders stay verbatim: an empty substitution hides the bug.
export function interpolate(template: string, params?: MessageParams): string {
	if (!params) return template;
	return template.replace(PLACEHOLDER, (whole, name: string) => {
		const value = params[name];
		return value === undefined ? whole : String(value);
	});
}
