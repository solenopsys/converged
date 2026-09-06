import { describe, expect, test } from "bun:test";
import { __testPanelEvent as toPanelEvent } from "./notifications";

describe("push frame narrowing", () => {
	test("a push frame becomes a panel event with its keys intact", () => {
		expect(
			toPanelEvent({
				type: "push",
				id: "m1",
				name: "order.created",
				level: "success",
				at: 1757000000000,
				titleKey: "notify.order.title",
				params: { number: "42" },
				link: { surface: "orders", ref: "42" },
			}),
		).toEqual({
			id: "m1",
			name: "order.created",
			level: "success",
			at: 1757000000000,
			titleKey: "notify.order.title",
			title: undefined,
			bodyKey: undefined,
			body: undefined,
			params: { number: "42" },
			link: { surface: "orders", ref: "42" },
		});
	});

	test("other signals on the same socket are not notifications", () => {
		// The channel carries call offers and dictation chunks too; only frames
		// the push router produced belong in the feed.
		expect(
			toPanelEvent({ type: "event", name: "call.answer", id: "x" }),
		).toBeNull();
		expect(toPanelEvent({ type: "push", name: "order.created" })).toBeNull();
		expect(toPanelEvent({ type: "push", id: "m1" })).toBeNull();
		expect(toPanelEvent(null)).toBeNull();
		expect(toPanelEvent("push")).toBeNull();
	});

	test("an unknown level falls back to info rather than dropping the message", () => {
		const event = toPanelEvent({
			type: "push",
			id: "m1",
			name: "order.created",
			level: "catastrophic",
		});

		expect(event?.level).toBe("info");
		// A frame with no timestamp is still shown; it just lands at "now".
		expect(event?.at).toBeGreaterThan(0);
	});
});
