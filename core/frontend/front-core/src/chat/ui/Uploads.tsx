import { $fileListItems, type FileListItem } from "files-state";
import { useUnit } from "effector-preact";
import { translator } from "i18n";
import { Pause, Play, RotateCcw, X } from "../../icons";
import { CHAT_MESSAGES_NAMESPACE } from "../i18n";

const t = translator(CHAT_MESSAGES_NAMESPACE);


export function Uploads() {
	const items = useUnit($fileListItems).filter(
		(item) => item.status !== "uploaded",
	);
	if (items.length === 0) return null;

	return (
		<div class="uploads">
			{items.map((item) => (
				<Upload key={item.fileId} item={item} />
			))}
		</div>
	);
}

function statusLabel(status: FileListItem["status"]): string {
	switch (status) {
		case "uploading":
			return t("uploads.statusUploading");
		case "paused":
			return t("uploads.statusPaused");
		case "error":
			return t("uploads.statusError");
		case "uploaded":
			return t("uploads.statusUploaded");
	}
}

function Upload({ item }: { item: FileListItem }) {
	return (
		<div class={`upload upload-${item.status}`}>
			<div class="upload-head">
				<span class="upload-name" title={item.name ?? item.fileId}>
					{item.name ?? item.fileId}
				</span>
				<span class="upload-status">
					{statusLabel(item.status)} · {item.progress}%
				</span>
				<span class="upload-actions">
					{item.status === "uploading" && item.onPause ? (
						<UploadAction label={t("uploads.pause")} icon={Pause} onClick={item.onPause} />
					) : null}
					{item.status === "paused" && item.onResume ? (
						<UploadAction label={t("uploads.resume")} icon={Play} onClick={item.onResume} />
					) : null}
					{item.status === "error" && item.onRetry ? (
						<UploadAction label={t("uploads.retry")} icon={RotateCcw} onClick={item.onRetry} />
					) : null}
					{item.onCancel ? (
						<UploadAction label={t("uploads.cancel")} icon={X} onClick={item.onCancel} />
					) : null}
				</span>
			</div>
			<div
				class="upload-track"
				role="progressbar"
				aria-valuenow={item.progress}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div class="upload-bar" style={{ width: `${item.progress}%` }} />
			</div>
		</div>
	);
}

function UploadAction({
	label,
	icon: Icon,
	onClick,
}: {
	label: string;
	icon: typeof Pause;
	onClick: () => void;
}) {
	return (
		<button type="button" class="upload-action" aria-label={label} title={label} onClick={onClick}>
			<Icon aria-hidden="true" size={14} />
		</button>
	);
}
