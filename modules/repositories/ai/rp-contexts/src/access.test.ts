import { describe, expect, it } from "bun:test";
import { ContextStoreService } from "./stores/contexts/service";

/**
 * `rp-contexts` keeps no tag table, and `access-control.md` says it should not:
 * the file name is the object id, and access to a context is the access of the
 * record pointing at it. What is left to defend here is the path itself — both
 * the name and the language become path segments and both come from the caller.
 */
describe("a context name cannot walk out of the store", () => {
	const store = {
		putJson: async () => undefined,
		getJson: async () => null,
		listKeys: async () => [] as string[],
		delete: async () => true,
	} as any;
	const contexts = new ContextStoreService(store);

	it("refuses a name that climbs out of its directory", async () => {
		for (const name of ["../secrets", "..", "a/../../b", "x/y"]) {
			expect(
				contexts.saveContext({ name, language: "en", data: {} } as any),
			).rejects.toThrow(/Unusable context name/);
		}
	});

	it("refuses a language that is a path rather than a language", async () => {
		expect(
			contexts.saveContext({
				name: "greeting",
				language: "../..",
				data: {},
			} as any),
		).rejects.toThrow(/Unusable context/);
	});

	it("accepts the names it is meant to store", async () => {
		const saved = await contexts.saveContext({
			name: "sales.intro",
			language: "pt-br",
			data: { hello: 1 },
		} as any);
		expect(saved.name).toBe("sales.intro");
		expect(saved.language).toBe("pt-br");
	});
});
