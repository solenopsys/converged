import { h } from "preact";
import { useCallback } from "preact/hooks";
import { FileDown } from "lucide-preact";
import { downloadRequested } from "files-state";
import styles from "./FileLinkMessage.module.css";

interface FileLinkMessageProps {
  fileId: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

const formatFileSize = (bytes?: number) => {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function FileLinkMessage({
  fileId,
  fileName,
  fileSize,
}: FileLinkMessageProps) {
  const displayName = fileName ?? fileId;
  const sizeLabel = formatFileSize(fileSize);

  const handleDownload = useCallback(() => {
    downloadRequested({ fileId, fileName: displayName });
  }, [fileId, displayName]);

  return (
    <button
      type="button"
      className={styles.fileLink}
      onClick={handleDownload}
      aria-label={`Скачать файл ${displayName}`}
    >
      <span className={styles.fileIcon} aria-hidden="true">
        <FileDown size={16} strokeWidth={1.6} />
      </span>
      <span className={styles.meta}>
        <span className={styles.fileName} title={displayName}>
          {displayName}
        </span>
        {sizeLabel && <span className={styles.fileSize}>{sizeLabel}</span>}
      </span>
    </button>
  );
}
