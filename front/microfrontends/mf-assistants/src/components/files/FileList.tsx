import React from 'react';
import { FileView } from './FileView';
import type { FileListItem } from 'files-state';

interface FileListProps {
  items: FileListItem[];
  emptyLabel?: string;
}

export function FileList({ items, emptyLabel }: FileListProps) {
  // Filter out completed uploads - they're now shown as link messages in chat
  const activeItems = items.filter(item => item.status !== 'uploaded');

  if (!activeItems.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {activeItems.map((item) => (
        <FileView key={item.fileId} item={item} />
      ))}
    </div>
  );
}
