import { createEffect, createEvent, createStore, sample } from "effector";
import type {
	GeoLiteDatabasePage,
	GeoLiteDatabaseStatus,
	GeoLiteDataset,
} from "g-analytics";
import analytics from "./service";

export const GEO_PAGE_SIZE = 100;
export const geoLiteDatasetSelected = createEvent<GeoLiteDataset>();
export const geoLitePageSelected = createEvent<number>();
export const geoLiteTableRefreshClicked = createEvent();

export const loadGeoLiteStatusFx = createEffect(() =>
	analytics.getGeoLiteDatabaseStatus(),
);

export const loadGeoLitePageFx = createEffect(
	({ dataset, offset }: { dataset: GeoLiteDataset; offset: number }) =>
		analytics.listGeoLiteDatabase(dataset, GEO_PAGE_SIZE, offset),
);

export const $geoLiteStatus = createStore<GeoLiteDatabaseStatus[]>([]).on(
	loadGeoLiteStatusFx.doneData,
	(_, status) => status,
);

export const $geoLiteDataset = createStore<GeoLiteDataset>("country").on(
	geoLiteDatasetSelected,
	(_, dataset) => dataset,
);

export const $geoLiteOffset = createStore(0)
	.on(geoLiteDatasetSelected, () => 0)
	.on(geoLitePageSelected, (_, offset) => Math.max(0, offset));

export const $geoLitePage = createStore<GeoLiteDatabasePage>({
	items: [],
	totalCount: 0,
})
	.on(geoLiteDatasetSelected, () => ({ items: [], totalCount: 0 }))
	.on(loadGeoLitePageFx.doneData, (_, page) => page);

export const $geoLiteError = createStore("")
	.on(geoLiteDatasetSelected, () => "")
	.on(geoLitePageSelected, () => "")
	.on(geoLiteTableRefreshClicked, () => "")
	.on(loadGeoLitePageFx.failData, (_, error) => error.message);

sample({
	clock: geoLiteDatasetSelected,
	fn: (dataset) => ({ dataset, offset: 0 }),
	target: loadGeoLitePageFx,
});

sample({
	clock: geoLitePageSelected,
	source: $geoLiteDataset,
	fn: (dataset, offset) => ({ dataset, offset }),
	target: loadGeoLitePageFx,
});

sample({
	clock: geoLiteTableRefreshClicked,
	source: { dataset: $geoLiteDataset, offset: $geoLiteOffset },
	target: [loadGeoLitePageFx, loadGeoLiteStatusFx],
});
