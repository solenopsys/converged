import { describe, expect, test } from "bun:test";
import {
	AUTH_TOKEN_KEY,
	authReleaseHash,
	authStorageRelease,
	createBrowserTokenStorage,
} from "./token-storage";

function memoryStorage(initial?: string) {
	const values = new Map<string, string>();
	if (initial !== undefined) values.set(AUTH_TOKEN_KEY, initial);
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
}

describe("versioned browser token storage", () => {
	test("uses the auth module build hash as its release", () => {
		expect(authReleaseHash("https://app.test/sf/auth.js?v=release-42")).toBe(
			"release-42",
		);
		expect(authReleaseHash("http://localhost/sf/auth.js")).toBe("development");
	});

	test("separates development tokens by mounted workspace", () => {
		expect(authStorageRelease("http://localhost/sf/auth.js", "club")).toBe(
			"development:club",
		);
		expect(authStorageRelease("http://localhost/sf/auth.js", "  ")).toBe(
			"development",
		);
	});

	test("reads a token written by the current release", async () => {
		const storage = memoryStorage();
		const tokens = createBrowserTokenStorage(storage, "release-42");
		await tokens.write({ accessToken: "header.payload.signature" });

		expect(await tokens.read()).toEqual({
			accessToken: "header.payload.signature",
		});
	});

	test("removes a token written by another release", async () => {
		const storage = memoryStorage(
			JSON.stringify({
				release: "release-41",
				accessToken: "header.payload.signature",
			}),
		);
		const tokens = createBrowserTokenStorage(storage, "release-42");

		expect(await tokens.read()).toBeNull();
		expect(storage.getItem(AUTH_TOKEN_KEY)).toBeNull();
	});

	test("removes legacy and malformed token records", async () => {
		for (const value of ["header.payload.signature", "{broken-json"]) {
			const storage = memoryStorage(value);
			const tokens = createBrowserTokenStorage(storage, "release-42");
			expect(await tokens.read()).toBeNull();
			expect(storage.getItem(AUTH_TOKEN_KEY)).toBeNull();
		}
	});
});
