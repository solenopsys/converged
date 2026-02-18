import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import FileView, { type FileViewStatus } from 'widget/components/files/FileView.tsx';

interface FileViewExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

const statuses: FileViewStatus[] = ['uploading', 'paused', 'error', 'uploaded'];

export default function FileViewExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: FileViewExampleProps) {
  const [status, setStatus] = useState<FileViewStatus>('uploading');
  const [progress, setProgress] = useState(32);

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>File View</h2>
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
      </div>

      <div style={{ marginTop: '20px' }}>
        <FileView
          fileId="file-001"
          name="design-guide.pdf"
          progress={progress}
          uploadedChunks={Math.round((progress / 100) * 12)}
          totalChunks={12}
          status={status}
          failedChunk={status === 'error' ? 8 : undefined}
          retriesLeft={status === 'error' ? 1 : undefined}
        />
      </div>
    </section>
  );
}
