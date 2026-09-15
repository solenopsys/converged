import { beforeEach, describe, expect, it } from "bun:test";
import type { JsonStore } from "back-core";
import { NotifyProfileStoreService } from "./stores/profile/service";

/**
 * The profile is read by every letter before it is rendered, so it must answer
 * on an install nobody configured, and must not store what a template cannot use.
 */
describe("sender profile", () => {
	let profile: NotifyProfileStoreService;

	beforeEach(() => {
		const rows = new Map<string, unknown>();
		const store = {
			putJson: async (key: string, value: unknown) => void rows.set(key, value),
			getJson: async (key: string) => rows.get(key),
			deleteJson: async (key: string) => rows.delete(key),
		} as unknown as JsonStore;
		profile = new NotifyProfileStoreService(store);
	});

	it("answers with English and a brand before anybody set it", async () => {
		expect(await profile.get()).toEqual({ lang: "en", brand: "Converge" });
	});

	it("keeps the base language tag a template is keyed by", async () => {
		await profile.save({ lang: "pt-BR" });
		expect((await profile.get()).lang).toBe("pt");
	});

	it("patches field by field and clears with an empty value", async () => {
		await profile.save({
			brand: " Acme Works ",
			supportEmail: "help@acme.test",
		});
		await profile.save({ address: "1 Example St" });
		expect(await profile.get()).toMatchObject({
			lang: "en",
			brand: "Acme Works",
			supportEmail: "help@acme.test",
			address: "1 Example St",
		});

		const cleared = await profile.save({ supportEmail: "", brand: "" });
		expect(cleared.supportEmail).toBeUndefined();
		expect(cleared.brand).toBe("Converge");
		expect(cleared.updatedAt).toBeDefined();
	});
});
