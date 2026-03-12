import React from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { Button, Progress, cn } from 'front-core';
import type { FileListItem } from 'files-state';

const statusLabel: Record<FileListItem['status'], string> = {
  uploading: 'Загрузка',
  paused: 'Пауза',
  error: 'Ошибка',
  uploaded: 'Готово',
};

const statusColor: Record<FileListItem['status'], string> = {
  uploading: 'text-blue-500',
  paused: 'text-yellow-500',
  error: 'text-red-500',
  uploaded: 'text-green-500',
};

export function FileView({ item }: { item: FileListItem }) {
  const totalChunksLabel = item.totalChunks > 0 ? item.totalChunks : '-';

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" title={item.name ?? item.fileId}>
            {item.name ?? item.fileId}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(statusColor[item.status])}>
              {statusLabel[item.status]}
            </span>
            <span>{item.progress}%</span>
            <span>{item.uploadedChunks} / {totalChunksLabel} chunks</span>
            {item.status === 'error' && typeof item.failedChunk === 'number' && (
              <span className="text-red-500">Chunk #{item.failedChunk} failed</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {item.status === 'uploading' && item.onPause && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={item.onPause}
              disabled={item.disablePause}
            >
              <Pause size={14} />
            </Button>
          )}

          {item.status === 'paused' && item.onResume && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={item.onResume}
              disabled={item.disableResume}
            >
              <Play size={14} />
            </Button>
          )}

          {item.status === 'error' && item.onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={item.onRetry}
              disabled={item.disableRetry}
            >
              <RotateCcw size={14} />
            </Button>
          )}

          {item.onCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={item.onCancel}
              disabled={item.disableCancel}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      <Progress value={item.progress} className="h-1.5" />
    </div>
  );
}
