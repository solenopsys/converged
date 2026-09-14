import { useUnit } from "effector-preact";
import { downloadRequested } from "files-state";
import { Button, Download, useSurfaceTranslation } from "front-core";
import { ModelViewer } from "front-core/model3d";
import { useEffect } from "preact/compat";
import { formatSize, isPreviewable, SURFACE_ID } from "../config";
import { $fileCard, fileOpened } from "../domain-files";

// One file, opened as a subtab inside the Files area.
//
// The download button is the library's `downloadRequested` event and nothing
// else: chunk fetching, decompression and the save dialog are `files-state`'s
// job, and this surface has no business reimplementing the half of it that would
// be easy. Same for the preview — `ModelViewer` pulls the blob through the same
// path the chat does.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function formatDate(value: string | undefined, dash: string): string {
	if (!value) return dash;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="break-all text-sm">{value}</span>
		</div>
	);
}

export function FileDetailView({ fileId }: { fileId?: string }) {
	const card = useUnit($fileCard);
	const { t } = useSurfaceTranslation(SURFACE_ID);
	const dash = text(t, "detail.empty");

	useEffect(() => {
		if (fileId) fileOpened({ fileId });
	}, [fileId]);

	const file = card.file;
	if (!file) {
		return (
			<div class="p-4 text-sm text-muted-foreground">
				{card.loading
					? text(t, "detail.loading")
					: (card.error ?? text(t, "detail.notFound"))}
			</div>
		);
	}

	return (
		<div class="flex flex-col gap-4 p-4">
			<header class="flex items-start justify-between gap-3">
				<div class="flex min-w-0 flex-col gap-1">
					<h1 class="break-all text-lg font-semibold">{file.name}</h1>
					<span class="text-sm text-muted-foreground">
						{file.fileType || dash} · {formatSize(file.fileSize)}
					</span>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<span class="rounded px-2 py-0.5 text-xs font-medium">
						{text(t, `status.${file.status}`)}
					</span>
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="gap-2"
						disabled={file.status !== "uploaded"}
						onClick={() =>
							downloadRequested({ fileId: file.id, fileName: file.name })
						}
					>
						<Download className="h-4 w-4" />
						{text(t, "actions.download")}
					</Button>
				</div>
			</header>

			{/* Only what `model-viewer` can actually render. Offering a preview for
			    an STL and showing an error instead is worse than not offering one. */}
			{isPreviewable(file.name) ? (
				<section class="h-72 overflow-hidden rounded-lg border border-border bg-card">
					<ModelViewer
						fileId={file.id}
						alt={file.name}
						style={{ height: "100%", width: "100%" }}
					/>
				</section>
			) : null}

			<section class="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field label={text(t, "columns.owner")} value={file.owner || dash} />
				<Field
					label={text(t, "detail.chunks")}
					value={String(file.chunksCount ?? 0)}
				/>
				<Field
					label={text(t, "detail.compression")}
					value={file.compression || dash}
				/>
				<Field
					label={text(t, "columns.created")}
					value={formatDate(file.createdAt, dash)}
				/>
			</section>

			<section class="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2">
				<Field
					label={text(t, "columns.collection")}
					value={
						card.collection?.name ??
						(file.collectionId
							? text(t, "detail.collectionHidden")
							: text(t, "detail.noCollection"))
					}
				/>
				{/* The hash is how de-duplication is verifiable from the screen: two
				    files with one hash are one blob stored once. */}
				<Field label={text(t, "detail.hash")} value={file.hash || dash} />
			</section>
		</div>
	);
}
