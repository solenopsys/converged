import { useMemo, useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import FileList from 'widget/components/files/FileList.tsx';
import type { FileViewStatus } from 'widget/components/files/FileView.tsx';

interface FileListExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

const statuses: FileViewStatus[] = ['uploading', 'paused', 'error', 'completed'];

export default function FileListExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: FileListExampleProps) {
  const [progress, setProgress] = useState(62);
  const [status, setStatus] = useState<FileViewStatus>('uploading');
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [lastAction, setLastAction] = useState<string>('—');

  const items = useMemo(() => {
    if (showPlaceholder) {
      return [];
    }

    const totalChunks = 16;
    const uploadedChunks = Math.min(totalChunks, Math.round((progress / 100) * totalChunks));
    const retriesLeft = status === 'error' ? 1 : undefined;
    const failedChunk = status === 'error' ? uploadedChunks + 1 : undefined;

    return [
      {
        fileId: 'demo-file',
        name: 'product-roadmap.pdf',
        progress,
        status,
        uploadedChunks,
        totalChunks,
        failedChunk,
        retriesLeft,
        onPause: () => setLastAction('Пауза'),
        onResume: () => setLastAction('Продолжить'),
        onCancel: () => setLastAction('Отмена'),
        onRetry: () => setLastAction('Повторить'),
      },
      {
        fileId: 'uploaded',
        name: 'invoice-0424.xlsx',
        progress: 100,
        status: 'uploaded' as const,
        uploadedChunks: totalChunks,
        totalChunks,
        onCancel: () => setLastAction('Удалить завершённый?'),
      },
    ];
  }, [progress, status, showPlaceholder]);

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>File List</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Прогресс&nbsp;
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onInput={(event) => setProgress(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </label>

        <label>
          Статус&nbsp;
          <select
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as FileViewStatus)}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={showPlaceholder}
            onChange={(event) => setShowPlaceholder(event.currentTarget.checked)}
          />
          показать empty-state
        </label>
      </div>

      <div style={{ marginTop: '20px' }}>
        <FileList items={items} emptyLabel="Нет файлов для загрузки" />
      </div>

      <div style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280' }}>
        Последнее действие: <strong>{lastAction}</strong>
      </div>
    </section>
  );
}
