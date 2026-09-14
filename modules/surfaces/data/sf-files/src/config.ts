import { resolveEmbeddedSurfaceMessage } from "front-core";
import { COLUMN_TYPES } from "front-core/table";
import type { FileStatus } from "g-files";

export const SURFACE_ID = "sf-files";

/**
 * Table metadata is read outside Preact — the object catalog is built before a
 * component exists — so it cannot use the translation hook. The key itself is
 * the fallback, which is what makes a missing translation visible rather than
 * silent.
 */
export function tr(key: string): string {
	const value = resolveEmbeddedSurfaceMessage(SURFACE_ID, key);
	return typeof value === "string" ? value : key;
}

export const FILE_STATUSES: readonly FileStatus[] = [
	"uploading",
	"uploaded",
	"failed",
];

const STATUS_CLASSES: Record<FileStatus, string> = {
	uploading: "bg-sky-100 text-sky-800",
	uploaded: "bg-emerald-100 text-emerald-800",
	failed: "bg-rose-100 text-rose-800",
};

export const fileStatusConfig = (): Record<
	string,
	{ label: string; className: string }
> =>
	Object.fromEntries(
		FILE_STATUSES.map((status) => [
			status,
			{ label: tr(`status.${status}`), className: STATUS_CLASSES[status] },
		]),
	);

export const statusOptions = () =>
	FILE_STATUSES.map((status) => ({
		value: status,
		label: tr(`status.${status}`),
	}));

/** Bytes as a person reads them. `fileSize` is raw bytes in the contract. */
export function formatSize(value: unknown): string {
	const bytes = Number(value);
	if (!Number.isFinite(bytes) || bytes < 0) return "—";
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let size = bytes / 1024;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit += 1;
	}
	return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/** Extensions `model-viewer` can actually render; anything else gets no preview. */
const PREVIEWABLE = [".glb", ".gltf"];

export function isPreviewable(name: string | undefined): boolean {
	const lower = (name ?? "").toLowerCase();
	return PREVIEWABLE.some((extension) => lower.endsWith(extension));
}

export const fileColumns = () => [
	{
		id: "name",
		title: tr("columns.name"),
		type: COLUMN_TYPES.TEXT,
		width: 320,
		primary: true,
		cardPrimary: true,
	},
	{
		id: "fileType",
		title: tr("columns.type"),
		type: COLUMN_TYPES.TEXT,
		width: 160,
	},
	{
		id: "fileSize",
		title: tr("columns.size"),
		type: COLUMN_TYPES.CUSTOM,
		width: 110,
		render: formatSize,
	},
	{
		id: "status",
		title: tr("columns.status"),
		type: COLUMN_TYPES.STATUS,
		width: 140,
		statusConfig: fileStatusConfig(),
	},
	{
		id: "owner",
		title: tr("columns.owner"),
		type: COLUMN_TYPES.TEXT,
		width: 160,
	},
	{
		id: "collectionId",
		title: tr("columns.collection"),
		type: COLUMN_TYPES.TEXT,
		width: 200,
		cardVisible: false,
		render: (value: string | undefined) => value ?? tr("detail.noCollection"),
	},
	{
		id: "createdAt",
		title: tr("columns.created"),
		type: COLUMN_TYPES.DATE,
		width: 170,
		cardVisible: false,
	},
];

export const collectionColumns = () => [
	{
		id: "name",
		title: tr("columns.name"),
		type: COLUMN_TYPES.TEXT,
		width: 280,
		primary: true,
		cardPrimary: true,
	},
	{
		id: "description",
		title: tr("columns.description"),
		type: COLUMN_TYPES.TEXT,
		width: 360,
	},
	{
		id: "owner",
		title: tr("columns.owner"),
		type: COLUMN_TYPES.TEXT,
		width: 160,
	},
	{
		id: "createdAt",
		title: tr("columns.created"),
		type: COLUMN_TYPES.DATE,
		width: 170,
	},
];
