export function required(name: string): string {
	const v = process.env[name];
	if (!v || !v.trim()) {
		throw new Error(`Missing required env: ${name}`);
	}
	return v;
}
