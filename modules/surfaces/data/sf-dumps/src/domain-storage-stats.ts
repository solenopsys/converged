import { createDomain, sample } from "effector";
import dumpsService from "./service";

const domain = createDomain("storage-stats");

export type StorageStats = {
	totalSize: number;
	storageCount: number;
	storages: { name: string; size: number }[];
};

const emptyStats: StorageStats = {
	totalSize: 0,
	storageCount: 0,
	storages: [],
};

export const storageStatsViewMounted = domain.createEvent(
	"STORAGE_STATS_VIEW_MOUNTED",
);
export const refreshStorageStats = domain.createEvent("REFRESH_STORAGE_STATS");

export const loadStorageStatsFx = domain.createEffect<void, StorageStats>({
	name: "LOAD_STORAGE_STATS",
	handler: async () => {
		return await (dumpsService as any).storageStats();
	},
});

export const $storageStats = domain.createStore<StorageStats>(emptyStats);
$storageStats.on(loadStorageStatsFx.doneData, (_, data) => data);

export const $storageStatsLoading = loadStorageStatsFx.pending;

sample({ clock: storageStatsViewMounted, target: loadStorageStatsFx });
sample({ clock: refreshStorageStats, target: loadStorageStatsFx });
