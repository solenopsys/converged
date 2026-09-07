export function formatElapsed(label: string, elapsedMs: number): string {
	return `[${label} ${Math.max(0, Math.round(elapsedMs))}ms]`;
}
