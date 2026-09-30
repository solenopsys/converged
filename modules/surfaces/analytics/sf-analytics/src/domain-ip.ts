import { createEffect, createEvent, createStore, sample } from "effector";
import type { AnalyticsIpSessionPage } from "g-analytics";
import analytics from "./service";

export const IP_SESSION_PAGE_SIZE = 100;
export const ipSessionsMounted = createEvent();
export const ipSessionsRefreshClicked = createEvent();
export const ipSessionsPageSelected = createEvent<number>();

export const loadIpSessionsFx = createEffect(({ offset }: { offset: number }) =>
	analytics.listIpSessions(IP_SESSION_PAGE_SIZE, offset),
);

export const $ipSessionOffset = createStore(0).on(
	ipSessionsPageSelected,
	(_, offset) => Math.max(0, offset),
);
export const $ipSessionPage = createStore<AnalyticsIpSessionPage>({
	items: [],
	totalCount: 0,
}).on(loadIpSessionsFx.doneData, (_, page) => page);
export const $ipSessionError = createStore("")
	.on(ipSessionsPageSelected, () => "")
	.on(ipSessionsRefreshClicked, () => "")
	.on(loadIpSessionsFx.failData, (_, error) => error.message);

sample({
	clock: [ipSessionsMounted, ipSessionsRefreshClicked],
	source: $ipSessionOffset,
	fn: (offset) => ({ offset }),
	target: loadIpSessionsFx,
});

sample({
	clock: ipSessionsPageSelected,
	fn: (offset) => ({ offset }),
	target: loadIpSessionsFx,
});
