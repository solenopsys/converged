import { expect, test } from "bun:test";
import { RedisClientPool, type RedisClient } from "./redisClientPool";

test("replaces a terminal client and retries the failed operation", async () => {
	let firstClosed = false;
	let attempts = 0;
	const failedClient = {
		get: async () => {
			attempts += 1;
			throw new Error("Connection has failed");
		},
		set: async () => {},
		expire: async () => {},
		getBuffer: async () => null,
		del: async () => {},
		close: () => {
			firstClosed = true;
		},
	} as unknown as RedisClient;
	const recoveredClient = {
		get: async () => {
			attempts += 1;
			return "recovered";
		},
		set: async () => {},
		expire: async () => {},
		getBuffer: async () => null,
		del: async () => {},
		close: () => {},
	} as unknown as RedisClient;
	let created = 0;
	const pool = new RedisClientPool(() => (++created === 1 ? failedClient : recoveredClient));

	expect(await pool.execute("redis://storage", (client) => client.get("key"))).toBe("recovered");
	expect(attempts).toBe(2);
	expect(created).toBe(2);
	expect(firstClosed).toBe(true);

	pool.close();
});

test("concurrent terminal failures share one replacement client", async () => {
	let firstClosed = 0;
	const failedClient = {
		get: async () => {
			throw new Error("Connection has failed");
		},
		set: async () => {},
		expire: async () => {},
		getBuffer: async () => null,
		del: async () => {},
		close: () => {
			firstClosed += 1;
		},
	} as unknown as RedisClient;
	const recoveredClient = {
		get: async (key: string) => key,
		set: async () => {},
		expire: async () => {},
		getBuffer: async () => null,
		del: async () => {},
		close: () => {},
	} as unknown as RedisClient;
	let created = 0;
	const pool = new RedisClientPool(() => (++created === 1 ? failedClient : recoveredClient));

	expect(
		await Promise.all([
			pool.execute("redis://storage", (client) => client.get("one")),
			pool.execute("redis://storage", (client) => client.get("two")),
		]),
	).toEqual(["one", "two"]);
	expect(created).toBe(2);
	expect(firstClosed).toBe(1);

	pool.close();
});
