import { createDomain, sample } from "effector";
import type { FileCollection, FileMetadata } from "g-files";
import { filesService } from "./service";

const domain = createDomain("sf-files");

export const filesViewMounted = domain.createEvent("FILES_VIEW_MOUNTED");
export const refreshFilesClicked = domain.createEvent("REFRESH_FILES_CLICKED");

/** A card was opened as a subtab, and which one. */
export const fileOpened = domain.createEvent<{ fileId: string }>("FILE_OPENED");

/** An operation persisted a change; every mounted view of that file redraws. */
export const fileChanged = domain.createEvent<FileMetadata>("FILE_CHANGED");

/** The file is gone; the card stops claiming otherwise. */
export const fileRemoved = domain.createEvent<string>("FILE_REMOVED");

const loadFileFx = domain.createEffect({
	name: "LOAD_FILE",
	handler: async (fileId: string) => {
		const file = await filesService.get(fileId);
		// The collection is a second read and an optional one: a file usually has
		// no collection, and a collection the caller may not see reads as none
		// rather than as an error.
		let collection: FileCollection | null = null;
		if (file?.collectionId) {
			try {
				collection =
					(await filesService.getCollection(file.collectionId)) ?? null;
			} catch {
				collection = null;
			}
		}
		return { file, collection };
	},
});

/** How many files there are at all — the one honest number `list` gives cheaply.
 *  `statistic()` in `rp-files` still answers `{}`, so nothing reads it. */
const loadTotalsFx = domain.createEffect({
	name: "LOAD_FILE_TOTALS",
	handler: async () => {
		const [files, collections] = await Promise.all([
			filesService.list({ offset: 0, limit: 1 }),
			filesService.listCollections({ offset: 0, limit: 1 }).catch(() => ({
				items: [],
				totalCount: 0,
			})),
		]);
		return {
			files: files.totalCount ?? 0,
			collections: collections.totalCount ?? 0,
		};
	},
});

export const $totals = domain
	.createStore<{ files: number; collections: number; loading: boolean }>({
		files: 0,
		collections: 0,
		loading: false,
	})
	.on(loadTotalsFx.pending, (state, loading) => ({ ...state, loading }))
	.on(loadTotalsFx.doneData, (state, totals) => ({
		...state,
		...totals,
		loading: false,
	}))
	.on(loadTotalsFx.failData, (state) => ({ ...state, loading: false }));

export const $fileCard = domain
	.createStore<{
		file: FileMetadata | null;
		collection: FileCollection | null;
		loading: boolean;
		error: string | null;
	}>({ file: null, collection: null, loading: false, error: null })
	.on(fileOpened, (state) => ({ ...state, file: null, error: null }))
	.on(loadFileFx.pending, (state, loading) => ({ ...state, loading }))
	.on(loadFileFx.doneData, (state, { file, collection }) => ({
		...state,
		file: file ?? null,
		collection,
		loading: false,
		error: null,
	}))
	.on(loadFileFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	.on(fileChanged, (state, file) =>
		state.file && state.file.id !== file.id ? state : { ...state, file },
	)
	.on(fileRemoved, (state, fileId) =>
		state.file?.id === fileId
			? { ...state, file: null, collection: null }
			: state,
	);

sample({
	clock: fileOpened,
	fn: ({ fileId }) => fileId,
	target: loadFileFx,
});

// Several tiles report mounting and they all want the same read.
sample({
	clock: filesViewMounted,
	filter: () => !loadTotalsFx.pending.getState(),
	target: loadTotalsFx,
});

sample({
	clock: [refreshFilesClicked, fileRemoved],
	target: loadTotalsFx,
});

export default domain;
