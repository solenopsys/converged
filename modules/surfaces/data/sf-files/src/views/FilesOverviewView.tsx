import { useUnit } from "effector-preact";
import { $fileListItems, type FileListItem, openFilePicker } from "files-state";
import {
	Button,
	HeaderPanelLayout,
	Pause,
	Play,
	RefreshCw,
	RotateCcw,
	Upload,
	useSurfaceTranslation,
	X,
} from "front-core";
import { useEffect } from "preact/compat";
import { SURFACE_ID, tr } from "../config";
import {
	$totals,
	filesViewMounted,
	refreshFilesClicked,
} from "../domain-files";

// The Files area's own screen: how much is stored, and what is moving right now.
//
// The in-flight list is the same `$fileListItems` the chat's upload strip reads,
// so an upload started from the console and one started from a message look the
// same and are the same. Pause, resume, retry and cancel are the library's
// events — this screen owns none of that behaviour, it only shows it.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function statusLabel(t: Translate, status: FileListItem["status"]): string {
	return text(t, `upload.${status}`);
}

function UploadRow({ item, t }: { item: FileListItem; t: Translate }) {
	return (
		<div class="flex flex-col gap-1 border-b border-border py-2 last:border-b-0">
			<div class="flex items-center justify-between gap-3">
				<span class="min-w-0 flex-1 truncate text-sm" title={item.name}>
					{item.name ?? item.fileId}
				</span>
				<span class="shrink-0 text-xs text-muted-foreground">
					{statusLabel(t, item.status)} · {item.progress}%
				</span>
				<span class="flex shrink-0 items-center gap-1">
					{item.onPause ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							class="h-7 w-7"
							title={text(t, "upload.pause")}
							onClick={item.onPause}
						>
							<Pause className="h-3.5 w-3.5" />
						</Button>
					) : null}
					{item.onResume ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							class="h-7 w-7"
							title={text(t, "upload.resume")}
							onClick={item.onResume}
						>
							<Play className="h-3.5 w-3.5" />
						</Button>
					) : null}
					{item.onRetry ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							class="h-7 w-7"
							title={text(t, "upload.retry")}
							onClick={item.onRetry}
						>
							<RotateCcw className="h-3.5 w-3.5" />
						</Button>
					) : null}
					{item.onCancel ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							class="h-7 w-7"
							title={text(t, "upload.cancel")}
							onClick={item.onCancel}
						>
							<X className="h-3.5 w-3.5" />
						</Button>
					) : null}
				</span>
			</div>
			<div class="h-1 w-full overflow-hidden rounded bg-muted">
				<div
					class="h-full bg-foreground/60"
					style={{ width: `${item.progress}%` }}
				/>
			</div>
		</div>
	);
}

function Tile({ label, value }: { label: string; value: string }) {
	return (
		<div class="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="text-2xl font-semibold">{value}</span>
		</div>
	);
}

export function FilesOverviewView() {
	const totals = useUnit($totals);
	const items = useUnit($fileListItems);
	const { t } = useSurfaceTranslation(SURFACE_ID);

	useEffect(() => {
		filesViewMounted();
	}, []);

	// Finished ones belong in the table, not in a progress strip.
	const active = items.filter((item) => item.status !== "uploaded");

	const headerConfig = {
		title: tr("menu.files"),
		actions: [
			{
				id: "refresh",
				label: tr("actions.refresh"),
				icon: RefreshCw,
				event: refreshFilesClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<HeaderPanelLayout config={headerConfig} contentClassName="p-4">
			<div class="flex h-full min-h-0 flex-col gap-4 overflow-auto">
				<div class="grid gap-3 md:grid-cols-3">
					<Tile
						label={text(t, "overview.storedFiles")}
						value={String(totals.files)}
					/>
					<Tile
						label={text(t, "overview.collections")}
						value={String(totals.collections)}
					/>
					<Tile
						label={text(t, "overview.inFlight")}
						value={String(active.length)}
					/>
				</div>

				{/* The one control this screen exists for. `openFilePicker` is the
				    library's event: it opens the OS dialog and runs the same chunked
				    upload the chat runs. */}
				<div>
					<Button
						type="button"
						class="gap-2"
						onClick={() => {
							openFilePicker();
						}}
					>
						<Upload className="h-4 w-4" />
						{text(t, "actions.upload")}
					</Button>
				</div>

				{active.length > 0 ? (
					<section class="flex flex-col gap-2">
						<h2 class="text-sm font-semibold">
							{text(t, "overview.uploading")}
						</h2>
						<div class="rounded-lg border border-border bg-card px-3 py-1">
							{active.map((item) => (
								<UploadRow key={item.fileId} item={item} t={t} />
							))}
						</div>
					</section>
				) : null}

				<p class="text-sm text-muted-foreground">{text(t, "overview.hint")}</p>
			</div>
		</HeaderPanelLayout>
	);
}
