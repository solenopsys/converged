import { $fileListItems, type FileListItem } from "files-state";
import { useUnit } from "effector-preact";
import { Pause, Play, RotateCcw, X } from "../../icons";


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

const STATUS_LABELS: Record<FileListItem["status"], string> = {
	uploading: "Загрузка",
	paused: "Пауза",
	error: "Ошибка",
	uploaded: "Готово",
};

function Upload({ item }: { item: FileListItem }) {
	return (
		<div class={`upload upload-${item.status}`}>
			<div class="upload-head">
				<span class="upload-name" title={item.name ?? item.fileId}>
					{item.name ?? item.fileId}
				</span>
				<span class="upload-status">
					{STATUS_LABELS[item.status]} · {item.progress}%
				</span>
				<span class="upload-actions">
					{item.status === "uploading" && item.onPause ? (
						<UploadAction label="Пауза" icon={Pause} onClick={item.onPause} />
					) : null}
					{item.status === "paused" && item.onResume ? (
						<UploadAction label="Продолжить" icon={Play} onClick={item.onResume} />
					) : null}
					{item.status === "error" && item.onRetry ? (
						<UploadAction label="Повторить" icon={RotateCcw} onClick={item.onRetry} />
					) : null}
					{item.onCancel ? (
						<UploadAction label="Отменить" icon={X} onClick={item.onCancel} />
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
