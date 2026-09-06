import { describe, expect, test } from "bun:test";
import {
	$rightPanelEvents,
	$rightPanelUnreadCount,
	rightPanelEventRecorded,
	rightPanelEventsCleared,
	rightPanelEventsHydrated,
	rightPanelTabActivated,
} from "./store";
import type { RightPanelEvent } from "./types";

function notification(
	id: string,
	at: number,
	extra: Partial<RightPanelEvent> = {},
): RightPanelEvent {
	return { id, name: "order.created", level: "info", at, ...extra };
}

function reset(): void {
	// The domain store is a module singleton, so each case starts from a known
	// feed rather than inheriting the previous one's.
	rightPanelEventsCleared();
}

describe("right panel event feed", () => {
	test("the same notification arriving live and in a replay is shown once", () => {
		reset();
		rightPanelEventRecorded(notification("a", 200));
		rightPanelEventsHydrated([notification("a", 200), notification("b", 100)]);

		expect($rightPanelEvents.getState().map((event) => event.id)).toEqual([
			"a",
			"b",
		]);
	});

	test("the feed is ordered newest first regardless of arrival order", () => {
		reset();
		rightPanelEventsHydrated([
			notification("old", 100),
			notification("new", 300),
		]);
		rightPanelEventRecorded(notification("middle", 200));

		expect($rightPanelEvents.getState().map((event) => event.id)).toEqual([
			"new",
			"middle",
			"old",
		]);
	});

	test("a replay does not mark an already-read notification unread again", () => {
		reset();
		rightPanelEventRecorded(notification("a", 100));
		rightPanelTabActivated("events");
		expect($rightPanelUnreadCount.getState()).toBe(0);

		rightPanelEventsHydrated([notification("a", 100)]);
		expect($rightPanelUnreadCount.getState()).toBe(0);
	});

	test("opening the events tab is what clears the badge", () => {
		reset();
		rightPanelEventRecorded(notification("a", 100));
		rightPanelEventRecorded(notification("b", 200));
		expect($rightPanelUnreadCount.getState()).toBe(2);

		// Another tab leaves the feed unread — only Events counts as seen.
		rightPanelTabActivated("chat");
		expect($rightPanelUnreadCount.getState()).toBe(2);

		rightPanelTabActivated("events");
		expect($rightPanelUnreadCount.getState()).toBe(0);
	});

	test("clearing drops the feed, which is what a session change needs", () => {
		reset();
		rightPanelEventRecorded(notification("a", 100));
		rightPanelEventsCleared();

		expect($rightPanelEvents.getState()).toEqual([]);
		expect($rightPanelUnreadCount.getState()).toBe(0);
	});

	test("the feed is bounded so a busy tenant cannot grow it without limit", () => {
		reset();
		rightPanelEventsHydrated(
			Array.from({ length: 120 }, (_, index) =>
				notification(`n${index}`, index),
			),
		);

		const feed = $rightPanelEvents.getState();
		expect(feed).toHaveLength(50);
		expect(feed[0].id).toBe("n119");
	});
});
