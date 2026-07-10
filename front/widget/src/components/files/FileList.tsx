import { h } from 'preact';
import type { JSX } from 'preact';
import FileView, { type FileViewProps } from './FileView';
import styles from './FileList.module.css';

export interface FileListItem extends FileViewProps {}

export interface FileListProps {
  items: FileListItem[];
  emptyLabel?: JSX.Element | string;
}

export default function FileList({ items, emptyLabel }: FileListProps) {
  const activeItems = items.filter((item) => item.status !== "uploaded");

  if (!activeItems.length) {
    if (items.length === 0) {
      return (
        <div className={styles.empty}>
          {emptyLabel ?? "Файлы не выбраны"}
        </div>
      );
    }
    return null;
  }

  return (
    <div className={styles.list}>
      {activeItems.map((item) => (
        <FileView key={item.fileId} {...item} />
      ))}
    </div>
  );
}
