import { beforeEach, describe, expect, test } from "bun:test";
import { createEvent, createStore } from "effector";
import { objectRegistry, surfaceConfigured } from "front-core/object-runtime";
import { homeSections } from "../dashboard/home";
import type { PinLayout } from "../tabs";
import {
	menus,
	surfacePinToggled,
	surfaces,
	workspaceReset,
} from "./workspace";
import {
	createLayoutSync,
	type LayoutClient,
	workspaceLayoutBindings,
} from "./workspace-layouts";

for (const id of ["sf-orders", "sf-team", "sf-equipment", "sf-reviews"]) {
	objectRegistry.declare(id, {
		id,
		label: id,
		purpose: `Test surface ${id}`,
		types: [],
		views: [],
		operations: [
			{ id: `${id}.probe`, operator: "execute", label: id, access: "public" },
		],
	});
}

/** A service that remembers layouts per account and scope, like `rp-environment`. */
function fakeService() {
	const accounts = new Map<string, Map<string, PinLayout>>();
	const saved: Array<{ scope: string; layout: PinLayout }> = [];
	const locales = new Map<string, string>();
	const savedLocales: string[] = [];
	let account: string | null = null;
	let failing = false;
	const scopes = () => {
		const key = account ?? "";
		if (!accounts.has(key)) accounts.set(key, new Map());
		return accounts.get(key) as Map<string, PinLayout>;
	};
	const client: LayoutClient = {
		async getCurrent() {
			if (failing) throw new Error("environment is not deployed");
			const stored = scopes();
			return {
				surfaces: stored.get("surfaces") ?? { pinned: [], unpinned: [] },
				layouts: [...stored.entries()]
					.filter(([scope]) => scope !== "surfaces")
					.map(([scope, layout]) => ({ scope, ...layout })),
				locale: locales.get(account ?? "") ?? "",
			};
		},
		async saveLocale(locale) {
			if (failing) throw new Error("environment is not deployed");
			savedLocales.push(locale);
			locales.set(account ?? "", locale);
		},
		async saveLayout(scope, layout) {
			if (failing) throw new Error("environment is not deployed");
			saved.push({ scope, layout });
			scopes().set(scope, layout);
		},
	};
	return {
		client,
		saved,
		locales,
		savedLocales,
		layout: (id: string, scope: string) => accounts.get(id)?.get(scope),
		store: (id: string, scope: string, layout: PinLayout) => {
			if (!accounts.has(id)) accounts.set(id, new Map());
			accounts.get(id)?.set(scope, layout);
		},
		signIn: (id: string | null) => {
			account = id;
		},
		fail: (value: boolean) => {
			failing = value;
		},
	};
}

const pinned = () => surfaces.$layout.getState().pinned;

describe("pins survive the page", () => {
	let service: ReturnType<typeof fakeService>;
	let sync: ReturnType<typeof createLayoutSync>;
	let subject: string | null;

	beforeEach(() => {
		sync?.stop();
		workspaceReset();
		surfaces.cleared();
		menus.cleared();
		homeSections.cleared();
		surfaceConfigured({
			surfaces: ["sf-orders", "sf-team", "sf-equipment", "sf-reviews"].map(
				(id) => ({ id }),
			),
		});
		service = fakeService();
		subject = null;
		sync = createLayoutSync({
			client: () => service.client,
			subject: () => subject,
			bindings: workspaceLayoutBindings(),
		});
	});

	const signIn = async (id: string | null) => {
		subject = id;
		service.signIn(id);
		await sync.refresh();
		await sync.flushed();
	};

	test("a signed-in user gets back what they pinned last time, everywhere", async () => {
		service.store("anna", "surfaces", { pinned: ["sf-orders"], unpinned: [] });
		service.store("anna", "menu:sf-orders", {
			pinned: ["view:orders.table"],
			unpinned: [],
		});
		service.store("anna", "home", { pinned: ["sf-team"], unpinned: [] });
		await signIn("anna");

		expect(pinned()).toEqual(["sf-orders"]);
		expect(menus.$layouts.getState()["sf-orders"]?.pinned).toEqual([
			"view:orders.table",
		]);
		expect(homeSections.$layout.getState().pinned).toEqual(["sf-team"]);
		expect(service.saved).toEqual([]);
	});

	test("each toggle writes only the place that changed", async () => {
		await signIn("anna");
		surfacePinToggled("sf-orders");
		surfacePinToggled("sf-team");
		menus.togglePin({ scope: "sf-orders", id: "view:orders.table" });
		await sync.flushed();

		expect(service.layout("anna", "surfaces")).toEqual({
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});
		expect(service.saved.map(({ scope }) => scope)).toEqual([
			"surfaces",
			"surfaces",
			"menu:sf-orders",
		]);
	});

	test("navigating home does not unpin, so the next save keeps the others", async () => {
		service.store("anna", "surfaces", {
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});
		await signIn("anna");
		workspaceReset();
		surfacePinToggled("sf-equipment");
		await sync.flushed();

		expect(service.layout("anna", "surfaces")?.pinned).toEqual([
			"sf-orders",
			"sf-team",
			"sf-equipment",
		]);
	});

	test("what a guest pinned is carried into the account they sign in to", async () => {
		service.store("anna", "surfaces", { pinned: ["sf-orders"], unpinned: [] });
		surfacePinToggled("sf-reviews");
		homeSections.opened("sf-team");
		await sync.flushed();
		expect(service.saved).toEqual([]);

		await signIn("anna");
		expect(pinned()).toEqual(["sf-orders", "sf-reviews"]);
		expect(service.layout("anna", "surfaces")?.pinned).toEqual([
			"sf-orders",
			"sf-reviews",
		]);
		expect(service.layout("anna", "home")?.pinned).toEqual(["sf-team"]);
	});

	test("signing out clears the previous account's pins", async () => {
		service.store("anna", "surfaces", { pinned: ["sf-orders"], unpinned: [] });
		service.store("anna", "home", { pinned: ["sf-team"], unpinned: [] });
		await signIn("anna");
		await signIn(null);
		expect(pinned()).toEqual([]);
		expect(homeSections.$layout.getState().pinned).toEqual([]);

		await signIn("boris");
		expect(pinned()).toEqual([]);
	});

	test("a service that never answered is not overwritten", async () => {
		service.store("anna", "surfaces", { pinned: ["sf-orders"], unpinned: [] });
		service.fail(true);
		await signIn("anna");
		surfacePinToggled("sf-team");
		await sync.flushed();
		expect(service.saved).toEqual([]);

		// The next reconnect reads first, then writes the merge.
		service.fail(false);
		await sync.refresh();
		await sync.flushed();
		expect(service.layout("anna", "surfaces")?.pinned).toEqual([
			"sf-orders",
			"sf-team",
		]);
	});
});

describe("the language follows the account", () => {
	const setup = () => {
		const service = fakeService();
		const localeChanged = createEvent<string>();
		const $locale = createStore("en").on(localeChanged, (_, locale) => locale);
		let subject: string | null = null;
		const sync = createLayoutSync({
			client: () => service.client,
			subject: () => subject,
			bindings: [],
			locale: {
				current: () => $locale.getState(),
				restored: (locale) => localeChanged(locale),
				changed: $locale.updates,
			},
		});
		const signIn = async (id: string | null) => {
			subject = id;
			service.signIn(id);
			await sync.refresh();
			await sync.flushed();
		};
		return { service, $locale, localeChanged, sync, signIn };
	};

	test("signing in brings back the language chosen on another machine", async () => {
		const { service, $locale, signIn, sync } = setup();
		service.locales.set("anna", "ru");
		await signIn("anna");

		expect($locale.getState()).toBe("ru");
		expect(service.savedLocales).toEqual([]);
		sync.stop();
	});

	test("a choice made while signed in is saved once", async () => {
		const { service, localeChanged, signIn, sync } = setup();
		await signIn("anna");
		localeChanged("de");
		localeChanged("de");
		await sync.flushed();

		expect(service.savedLocales).toEqual(["de"]);
		sync.stop();
	});

	test("a guest's choice is carried into the account", async () => {
		const { service, $locale, localeChanged, signIn, sync } = setup();
		service.locales.set("anna", "ru");
		localeChanged("fr");
		await signIn("anna");

		expect($locale.getState()).toBe("fr");
		expect(service.locales.get("anna")).toBe("fr");
		sync.stop();
	});
});
