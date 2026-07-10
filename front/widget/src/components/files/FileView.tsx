import { h } from "preact";
import type { JSX } from "preact";
import styles from "./FileView.module.css";
import ProgressBar from "../progress-bar/ProgressBar";
import { IconButton, ButtonSize } from "../icon-button/IconButton";
import { Download, Pause, Play, RotateCcw, X } from "lucide-preact";

export type FileViewStatus = "uploading" | "paused" | "error" | "uploaded";

export interface FileViewProps {
  fileId: string;
  name?: string;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  status: FileViewStatus;
  failedChunk?: number | null;
  retriesLeft?: number;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  disablePause?: boolean;
  disableResume?: boolean;
  disableCancel?: boolean;
  disableRetry?: boolean;
  disableDownload?: boolean;
}

const clampProgress = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

const statusLabel: Record<FileViewStatus, string> = {
  uploading: "Загрузка",
  paused: "На паузе",
  error: "Ошибка",
  uploaded: "Готово",
};

export default function FileView({
  fileId,
  name,
  progress,
  uploadedChunks,
  totalChunks,
  status,
  failedChunk = null,
  retriesLeft,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDownload,
  disablePause,
  disableResume,
  disableCancel,
  disableRetry,
  disableDownload,
}: FileViewProps) {
  const progressValue = clampProgress(progress);
  const totalChunksLabel = totalChunks > 0 ? totalChunks : "—";
  const isDownloadable = typeof onDownload === "function";

  const handleDownload = () => {
    if (!isDownloadable || disableDownload) return;
    onDownload?.();
  };

  const handleDownloadLinkClick = (
    event: JSX.TargetedMouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    handleDownload();
  };

  const handleDownloadKeyDown = (
    event: JSX.TargetedKeyboardEvent<HTMLDivElement>,
  ) => {
    if (!isDownloadable || disableDownload) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDownload?.();
    }
  };

  const statusClassName = (() => {
    switch (status) {
      case "paused":
        return styles.statusPaused;
      case "error":
        return styles.statusError;
      case "uploaded":
        return styles.statusUploaded;
      default:
        return styles.statusUploading;
    }
  })();

  return (
    <div className={styles.fileView} data-file-id={fileId}>
      <div className={styles.topRow}>
        <div
          className={`${styles.metaBlock} ${isDownloadable ? styles.metaBlockInteractive : ""}`}
          tabIndex={isDownloadable ? 0 : undefined}
          role={isDownloadable ? "button" : undefined}
          onClick={isDownloadable ? handleDownload : undefined}
          onKeyDown={isDownloadable ? handleDownloadKeyDown : undefined}
          aria-disabled={disableDownload}
        >
          <span className={styles.title} title={name ?? fileId}>
            {name ?? fileId}
          </span>
          <div className={styles.infoRow}>
            <span className={`${styles.statusLabel} ${statusClassName}`}>
              {statusLabel[status]}
            </span>
            <span className={styles.infoText}>{progressValue}%</span>
            <span className={styles.infoText}>
              {uploadedChunks} / {totalChunksLabel} чанков
            </span>
            {status === "error" &&
              typeof failedChunk === "number" &&
              failedChunk >= 0 && (
                <span className={`${styles.infoText} ${styles.infoError}`}>
                  Ошибка на чанке #{failedChunk}
                </span>
              )}
            {typeof retriesLeft === "number" &&
              retriesLeft >= 0 &&
              status === "error" && (
                <span className={`${styles.infoText} ${styles.infoError}`}>
                  Повторений осталось: {retriesLeft}
                </span>
              )}
          </div>
          {isDownloadable && (
            <a
              href={`#download-${fileId}`}
              className={styles.downloadLink}
              onClick={handleDownloadLinkClick}
              aria-disabled={disableDownload}
            >
              <Download size={14} strokeWidth={1.8} />
              Скачать
            </a>
          )}
        </div>

        <div className={styles.actions}>
          {status === "uploading" && onPause && (
            <IconButton
              onClick={onPause}
              icon={Pause}
              size={ButtonSize.Small}
              ariaLabel="Пауза"
              disabled={disablePause}
            />
          )}

          {status === "paused" && onResume && (
            <IconButton
              onClick={onResume}
              icon={Play}
              size={ButtonSize.Small}
              ariaLabel="Продолжить"
              disabled={disableResume}
            />
          )}

          {status === "error" && onRetry && (
            <IconButton
              onClick={onRetry}
              icon={RotateCcw}
              size={ButtonSize.Small}
              ariaLabel="Повторить"
              disabled={disableRetry}
            />
          )}

          {onCancel && (
            <IconButton
              onClick={onCancel}
              icon={X}
              size={ButtonSize.Small}
              ariaLabel="Отменить"
              disabled={disableCancel}
            />
          )}
        </div>
      </div>

      <ProgressBar
        value={progressValue}
        ariaLabel={`Прогресс загрузки ${name ?? fileId}`}
        className={styles.progressBar}
      />
    </div>
  );
}
