/** Bounded concurrency and the backoff that makes it safe to raise. */

import { describe, expect, test } from "bun:test";
import {
	configuredConcurrency,
	DEFAULT_CONCURRENCY,
	HttpError,
	pool,
	withRetry,
} from "./pool";

describe("configuredConcurrency", () => {
	test("reads the environment, floors it, and caps it", () => {
		expect(configuredConcurrency("6")).toBe(6);
		expect(configuredConcurrency("6.9")).toBe(6);
		expect(configuredConcurrency("999")).toBe(32);
	});

	test("anything unusable falls back to the default rather than to zero", () => {
		for (const value of [undefined, "", "0", "-4", "many"]) {
			expect(configuredConcurrency(value)).toBe(DEFAULT_CONCURRENCY);
		}
	});
});

describe("pool", () => {
	test("results keep input order however the work finishes", async () => {
		const results = await pool([30, 1, 20, 2], 4, async (ms, index) => {
			await Bun.sleep(ms);
			return index;
		});
		expect(results).toEqual([0, 1, 2, 3]);
	});

	test("never exceeds the limit", async () => {
		let live = 0;
		let peak = 0;
		await pool(
			Array.from({ length: 20 }, (_, i) => i),
			3,
			async () => {
				live += 1;
				peak = Math.max(peak, live);
				await Bun.sleep(2);
				live -= 1;
				return null;
			},
		);
		expect(peak).toBe(3);
	});

	test("an empty queue starts nothing", async () => {
		let calls = 0;
		expect(
			await pool([], 4, async () => {
				calls += 1;
				return 1;
			}),
		).toEqual([]);
		expect(calls).toBe(0);
	});

	test("a failure propagates and stops handing out new work", async () => {
		let started = 0;
		const run = pool(
			Array.from({ length: 50 }, (_, i) => i),
			2,
			async (i) => {
				started += 1;
				await Bun.sleep(1);
				if (i === 1) throw new Error("boom");
				return i;
			},
		);
		expect(run).rejects.toThrow("boom");
		await run.catch(() => {});
		// The two in flight when it failed may finish; the other forty-eight
		// must not have been started.
		expect(started).toBeLessThan(10);
	});
});

describe("withRetry", () => {
	test("a rate limit is retried and the eventual answer is returned", async () => {
		let attempts = 0;
		const value = await withRetry(
			async () => {
				attempts += 1;
				if (attempts < 3) throw new HttpError(429, "slow down");
				return "ok";
			},
			{ baseDelayMs: 1 },
		);
		expect(value).toBe("ok");
		expect(attempts).toBe(3);
	});

	test("a bad request is not retried — waiting cannot fix it", async () => {
		let attempts = 0;
		expect(
			withRetry(
				async () => {
					attempts += 1;
					throw new HttpError(400, "malformed");
				},
				{ baseDelayMs: 1 },
			),
		).rejects.toThrow("malformed");
		await Bun.sleep(5);
		expect(attempts).toBe(1);
	});

	test("it gives up after the configured attempts and reports the last error", async () => {
		let attempts = 0;
		const seen: number[] = [];
		await expect(
			withRetry(
				async () => {
					attempts += 1;
					throw new HttpError(503, "unavailable");
				},
				{ attempts: 3, baseDelayMs: 1, onRetry: (n) => seen.push(n) },
			),
		).rejects.toThrow("unavailable");
		expect(attempts).toBe(3);
		expect(seen).toEqual([1, 2]);
	});
});
