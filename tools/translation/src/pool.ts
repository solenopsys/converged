/**
 * Running translation batches several at a time.
 *
 * The work is network-bound: a batch is one HTTPS request that the model
 * spends tens of seconds answering, and the process does nothing while it
 * waits. Worker threads would buy nothing here — there is no CPU to spread —
 * so this is a bounded async pool, and the parallelism is real for exactly
 * the reason it matters.
 *
 * Bounded rather than unbounded because the provider rate-limits: an
 * unbounded fan-out over six locales turns a queue into a wall of 429s. The
 * limit is a knob (`DOCS_TRANSLATION_CONCURRENCY`), the backoff below is the
 * safety net for when the knob is set too high anyway.
 */

export const DEFAULT_CONCURRENCY = 4;

export function configuredConcurrency(
	value = process.env.DOCS_TRANSLATION_CONCURRENCY,
): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONCURRENCY;
	return Math.min(Math.floor(parsed), 32);
}

/**
 * Map over `items` with at most `limit` in flight, preserving input order in
 * the result. Nothing is swallowed: the first rejection propagates once the
 * already-started work has settled, so a failed run cannot leave requests
 * running against a store that is about to close.
 */
export async function pool<T, R>(
	items: readonly T[],
	limit: number,
	worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	if (items.length === 0) return results;

	const width = Math.max(1, Math.min(limit, items.length));
	let next = 0;
	let failure: unknown;

	const run = async (): Promise<void> => {
		while (true) {
			const index = next++;
			if (index >= items.length || failure !== undefined) return;
			try {
				results[index] = await worker(items[index] as T, index);
			} catch (error) {
				failure ??= error;
				return;
			}
		}
	};

	await Promise.all(Array.from({ length: width }, run));
	if (failure !== undefined) throw failure;
	return results;
}

export type RetryOptions = {
	attempts?: number;
	baseDelayMs?: number;
	/** Called before each wait, for the run log. */
	onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

/** HTTP status carried out of the request layer so backoff can see it. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "HttpError";
	}
}

function retryable(error: unknown): boolean {
	if (error instanceof HttpError) {
		return error.status === 408 || error.status === 429 || error.status >= 500;
	}
	// Sockets die on their own schedule; a dropped connection is always worth
	// one more try.
	return error instanceof TypeError || error instanceof Error;
}

/**
 * Exponential backoff with jitter. Jitter matters more than usual here: with
 * `limit` requests in flight, a rate-limit response arrives for all of them at
 * once, and a fixed delay would retry all of them at once too.
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const attempts = options.attempts ?? 4;
	const base = options.baseDelayMs ?? 1_000;
	let lastError: unknown;

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (attempt === attempts - 1 || !retryable(error)) throw error;
			const delay = Math.round(base * 2 ** attempt * (0.5 + Math.random()));
			options.onRetry?.(attempt + 1, delay, error);
			await Bun.sleep(delay);
		}
	}
	throw lastError;
}
