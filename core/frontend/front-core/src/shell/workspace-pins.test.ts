import { beforeEach, describe, expect, test } from "bun:test";
import type { SurfaceLayout } from "g-environment/browser";
import {
	$surfacePins,
	surfacePinsRestored,
	surfacePinToggled,
	workspaceReset,
} from "./workspace";
import {
	createPinSync,
	layoutFromPins,
	type PinClient,
	pinsFromLayout,
} from "./workspace-pins";

/** A service that remembers one layout per account, like `rp-environment`. */
function fakeService() {
	const layouts = new Map<string, SurfaceLayout>();
	const saved: SurfaceLayout[] = [];
	let account: string | null = null;
	let failing = false;
	const client: PinClient = {
		async getCurrent() {
			if (failing) throw new Error("environment is not deployed");
			return {
				surfaces: layouts.get(account ?? "") ?? { pinned: [], unpinned: [] },
			};
		},
		async saveSurfaceLayout(layout) {
			if (failing) throw new Error("environment is not deployed");
			saved.push(layout);
			layouts.set(account ?? "", layout);
		},
	};
	return {
		client,
		layouts,
		saved,
		signIn: (id: string | null) => {
			account = id;
		},
		fail: (value: boolean) => {
			failing = value;
		},
	};
}

describe("layout conversion", () => {
	test("overrides round-trip through the stored shape", () => {
		const pins = { "sf-orders": true, "sf-logs": false, "sf-team": true };
		expect(layoutFromPins(pins)).toEqual({
			pinned: ["sf-orders", "sf-team"],
			unpinned: ["sf-logs"],
		});
		expect(pinsFromLayout(layoutFromPins(pins))).toEqual(pins);
		expect(pinsFromLayout(undefined)).toEqual({});
	});
});

describe("pins survive the page", () => {
	let service: ReturnType<typeof fakeService>;
	let sync: ReturnType<typeof createPinSync>;
	let subject: string | null;

	beforeEach(() => {
		sync?.stop();
		surfacePinsRestored({});
		service = fakeService();
		subject = null;
		sync = createPinSync({
			client: () => service.client,
			subject: () => subject,
		});
	});

	const signIn = async (id: string | null) => {
		subject = id;
		service.signIn(id);
		await sync.refresh();
		await sync.flushed();
	};

	test("a signed-in user gets back what they pinned last time", async () => {
		service.layouts.set("anna", { pinned: ["sf-orders"], unpinned: [] });
		await signIn("anna");

		expect($surfacePins.getState()).toEqual({ "sf-orders": true });
		expect(service.saved).toEqual([]);
	});

	test("every toggle writes the whole layout", async () => {
		await signIn("anna");
		surfacePinToggled("sf-orders");
		surfacePinToggled("sf-team");
		await sync.flushed();

		expect(service.layouts.get("anna")).toEqual({
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});
	});

	test("navigating home does not unpin, so the next save keeps the others", async () => {
		service.layouts.set("anna", {
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});
		await signIn("anna");
		workspaceReset();
		surfacePinToggled("sf-equipment");
		await sync.flushed();

		expect(service.layouts.get("anna")?.pinned).toEqual([
			"sf-equipment",
			"sf-orders",
			"sf-team",
		]);
	});

	test("what a guest pinned is carried into the account they sign in to", async () => {
		service.layouts.set("anna", { pinned: ["sf-orders"], unpinned: [] });
		surfacePinToggled("sf-reviews");
		await sync.flushed();
		expect(service.saved).toEqual([]);

		await signIn("anna");
		expect($surfacePins.getState()).toEqual({
			"sf-orders": true,
			"sf-reviews": true,
		});
		expect(service.layouts.get("anna")?.pinned).toEqual([
			"sf-orders",
			"sf-reviews",
		]);
	});

	test("signing out clears the previous account's pins", async () => {
		service.layouts.set("anna", { pinned: ["sf-orders"], unpinned: [] });
		await signIn("anna");
		await signIn(null);
		expect($surfacePins.getState()).toEqual({});

		await signIn("boris");
		expect($surfacePins.getState()).toEqual({});
	});

	test("a service that never answered is not overwritten", async () => {
		service.layouts.set("anna", { pinned: ["sf-orders"], unpinned: [] });
		service.fail(true);
		await signIn("anna");
		surfacePinToggled("sf-team");
		await sync.flushed();
		expect(service.saved).toEqual([]);

		// The next reconnect reads first, then writes the merge.
		service.fail(false);
		await sync.refresh();
		await sync.flushed();
		expect(service.layouts.get("anna")?.pinned).toEqual([
			"sf-orders",
			"sf-team",
		]);
	});
});
