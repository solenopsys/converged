import { downloadRequested, openFilePicker } from "files-state";
import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
	setRef,
} from "front-core/object-runtime";
import type { PaginationParams } from "g-files";
import { collectionColumns, fileColumns, statusOptions, tr } from "./config";
import { fileChanged, fileRemoved } from "./domain-files";
import { filesService } from "./service";
import { FileDetailView } from "./views/FileDetailView";
import { FilesOverviewView } from "./views/FilesOverviewView";

// Files as one working area.
//
// What was missing here was never the transport. Chunked upload, pause/resume,
// de-duplication by hash and the save-dialog download all live in `files-state`
// and have been carrying the chat for a while. What did not exist was any way to
// reach them from the console: the surface was a table with `operations: []`, so
// a file could be looked at and nothing else.
//
// So every operation below is a call into that library or one call into
// `rp-files`. None of it is new machinery, and none of it should be.

const listFiles = (params: Record<string, unknown>) =>
	filesService.list(params as PaginationParams);

const listCollections = (params: Record<string, unknown>) =>
	filesService.listCollections(params as PaginationParams);

export const objects = [
	{
		id: "files.file",
		label: "File",
		labelKey: "types.file.label",
		pluralLabel: "Files",
		pluralLabelKey: "menu.files",
		description:
			"One uploaded file: what it is, who put it here, how big it is and which collection it belongs to",
		descriptionKey: "types.file.description",
		categories: [Category.Entity, Category.Selectable],
		selection: {
			filters: [
				{
					id: "status",
					label: tr("columns.status"),
					valueType: "string",
					operators: ["eq", "in"],
					control: "select",
					options: statusOptions().map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
			],
			load: listFiles,
		},
		infinity: {
			tableId: "files",
			title: tr("menu.files"),
			columns: fileColumns(),
			load: listFiles,
			rowRef: (row) => {
				const file = row as { id?: unknown; name?: unknown };
				const id = String(file.id ?? "");
				return objectRef("files.file", id, {
					title: typeof file.name === "string" ? file.name : id,
				});
			},
			filters: [
				{
					id: "name",
					label: tr("columns.name"),
					type: "search",
					operator: "contains",
				},
				{
					id: "fileType",
					label: tr("columns.type"),
					type: "search",
					operator: "contains",
				},
				{
					id: "owner",
					label: tr("columns.owner"),
					type: "search",
					operator: "contains",
				},
				{
					id: "status",
					label: tr("columns.status"),
					type: "select",
					operator: "eq",
					options: statusOptions(),
				},
				{
					id: "collectionId",
					label: tr("columns.collection"),
					type: "search",
					operator: "eq",
				},
				{
					id: "createdAt",
					label: tr("columns.created"),
					type: "date-range",
					operator: "between",
					valueType: "date",
				},
			],
			mobile: { title: "name", subtitle: "fileType", badge: "status" },
		},
	},
	{
		id: "files.collection",
		label: "Collection",
		labelKey: "types.collection.label",
		pluralLabel: "Collections",
		pluralLabelKey: "menu.collections",
		description:
			"A named grouping of files. A grouping only — it grants nobody access to anything",
		descriptionKey: "types.collection.description",
		categories: [Category.Entity, Category.Selectable, Category.Creatable],
		selection: {
			filters: [],
			load: listCollections,
		},
		infinity: {
			tableId: "file-collections",
			title: tr("menu.collections"),
			columns: collectionColumns(),
			load: listCollections,
			// A collection is not a thing to open — what is in it is. Clicking one
			// opens the files table narrowed to exactly those files.
			rowRef: (row) => {
				const collection = row as { id?: unknown; name?: unknown };
				return setRef(
					"files.file",
					{
						kind: "query",
						filter: { collectionId: { eq: String(collection.id ?? "") } },
					},
					{
						title:
							typeof collection.name === "string"
								? collection.name
								: tr("menu.collections"),
					},
				);
			},
			filters: [
				{
					id: "name",
					label: tr("columns.name"),
					type: "search",
					operator: "contains",
				},
				{
					id: "owner",
					label: tr("columns.owner"),
					type: "search",
					operator: "contains",
				},
			],
			mobile: { title: "name", subtitle: "description" },
		},
	},
	{
		// The surface's own screen. A statistical type with no `component` is
		// resolved through its `setOf` view, which the shell then gives the full
		// row — so the overview is what this tab shows when no button is pressed,
		// and a button of its own besides.
		id: "files.statistic",
		label: "Overview",
		labelKey: "menu.overview",
		pluralLabel: "Overview",
		pluralLabelKey: "menu.overview",
		categories: [Category.Statistic, Category.Entity],
	},
] satisfies readonly ObjectDefinition[];

/** The one reference every file operation needs. */
function fileIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "files.file",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id) throw new Error(tr("errors.noFile"));
	return ref.id;
}

export default defineSurface({
	id: "sf-files",
	label: "Files",
	labelKey: "surface.label",
	purpose:
		"Uploaded files and everything extracted from them: upload from the console, look inside, download, and see which collection a file belongs to",
	purposeKey: "surface.purpose",
	types: objects,
	views: [
		{
			id: "files.file.detail",
			accepts: objectOf("files.file"),
			component: FileDetailView,
			props: (ref) => ({
				fileId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "files.file.table",
			label: "Files",
			accepts: setOf("files.file"),
			component: EntityListView,
		},
		{
			id: "files.collection.table",
			label: "Collections",
			accepts: setOf("files.collection"),
			component: EntityListView,
		},
		{
			id: "files.statistic.dashboard",
			label: "Overview",
			accepts: setOf("files.statistic"),
			component: FilesOverviewView,
		},
	],
	operations: [
		{
			/**
			 * Upload, as the console's version of dropping a file into the chat.
			 *
			 * There is no `fileIds` parameter and there cannot be one: the operation
			 * has to get at `File` objects, and only a user gesture produces those.
			 * So this opens the OS picker and hands what comes back to `files-state`,
			 * which does the chunking, the compression and the retries. Progress is
			 * on the overview screen, because the upload outlives this call.
			 */
			id: "files.file.upload",
			operator: "create",
			target: "files.file",
			label: "Upload files",
			labelKey: "operations.upload.label",
			description:
				"Open the file picker and upload what is chosen. Large files are chunked and can be paused, resumed and retried; identical content is stored once. Progress is on the Files overview.",
			descriptionKey: "operations.upload.description",
			invoke: () => {
				openFilePicker();
				return { started: true };
			},
		},
		{
			id: "files.file.download",
			operator: "execute",
			target: "files.file",
			label: "Download",
			labelKey: "operations.download.label",
			description:
				"Fetch a file's chunks, put them back together and save it. Asks where to save when the browser allows it.",
			descriptionKey: "operations.download.description",
			inputs: [{ name: "file", accepts: objectOf("files.file") }],
			invoke: async ({ references }) => {
				const id = fileIdOf(references);
				const file = await filesService.get(id);
				if (!file) throw new Error(tr("errors.noFile"));
				if (file.status !== "uploaded")
					throw new Error(tr("errors.notUploaded"));
				// Fire-and-follow: the library owns the transfer and reports progress
				// through its own stores, so there is nothing to await here.
				downloadRequested({ fileId: id, fileName: file.name });
				return { fileId: id, fileName: file.name };
			},
		},
		{
			id: "files.file.delete",
			operator: "delete",
			target: "files.file",
			label: "Delete file",
			labelKey: "operations.delete.label",
			description:
				"Remove a file's record. Chunks shared with another file by hash stay where they are — de-duplication means the blob is not this file's to drop.",
			descriptionKey: "operations.delete.description",
			inputs: [{ name: "file", accepts: objectOf("files.file") }],
			invoke: async ({ references }) => {
				const id = fileIdOf(references);
				await filesService.delete(id);
				fileRemoved(id);
				return { deleted: id };
			},
		},
		{
			/**
			 * Put a file in a collection.
			 *
			 * `update` takes the whole record, so this reads first and writes the
			 * read-back with one field changed — sending a partial would blank the
			 * rest. An empty `collectionId` takes the file out of its collection.
			 */
			id: "files.file.setCollection",
			operator: "execute",
			target: "files.file",
			label: "Move to a collection",
			labelKey: "operations.setCollection.label",
			description:
				"Put a file in a collection, or take it out of one by leaving the collection empty.",
			descriptionKey: "operations.setCollection.description",
			inputs: [{ name: "file", accepts: objectOf("files.file") }],
			parameters: {
				type: "object",
				properties: {
					collectionId: {
						type: "string",
						description: "Collection id; empty takes the file out of one",
					},
				},
			},
			invoke: async ({ references, params }) => {
				const id = fileIdOf(references);
				const file = await filesService.get(id);
				if (!file) throw new Error(tr("errors.noFile"));
				const collectionId = String(params.collectionId ?? "").trim();
				const next = { ...file, collectionId: collectionId || undefined };
				await filesService.update(id, next);
				fileChanged(next);
				return next;
			},
		},
		{
			id: "files.collection.create",
			operator: "create",
			target: "files.collection",
			label: "Create collection",
			labelKey: "operations.collectionCreate.label",
			description:
				"Name a grouping for files. It groups and nothing more: a collection grants nobody access to what is in it.",
			descriptionKey: "operations.collectionCreate.description",
			output: setOf("files.collection"),
			parameters: {
				type: "object",
				properties: {
					name: { type: "string" },
					description: { type: "string" },
				},
				required: ["name"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				// The id is minted here because `saveCollection` takes a whole record;
				// the owner is settled server-side from the token, so whatever is sent
				// is ignored.
				const id = crypto.randomUUID();
				await filesService.saveCollection({
					id,
					name: String(params.name),
					...(params.description
						? { description: String(params.description) }
						: {}),
					owner: "",
					createdAt: new Date().toISOString(),
				});
				return setRef(
					"files.collection",
					{ kind: "ids", ids: [id] },
					{
						title: String(params.name),
					},
				);
			},
		},
	],
});
