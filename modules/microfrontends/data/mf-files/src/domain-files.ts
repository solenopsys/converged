import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { PaginationParams } from "g-files";
import filesService from "./service";

const domain = createDomain("files");

export const filesViewMounted = domain.createEvent("FILES_VIEW_MOUNTED");
export const refreshFilesClicked = domain.createEvent("REFRESH_FILES_CLICKED");

type FilesListParams = Omit<PaginationParams, "key"> & {
	name?: unknown;
};

const listFilesFx = domain.createEffect<FilesListParams, unknown>({
	name: "LIST_FILES",
	handler: ({ name, offset, limit }) =>
		filesService.list({
			key: typeof name === "string" ? name : "",
			offset,
			limit,
		}),
});

export const $filesStore = createInfiniteTableStore(domain, listFilesFx);

for (const clock of [filesViewMounted, refreshFilesClicked]) {
	sample({ clock, fn: () => ({}), target: $filesStore.reset });
	sample({ clock, fn: () => ({}), target: $filesStore.loadMore });
}

export default domain;
