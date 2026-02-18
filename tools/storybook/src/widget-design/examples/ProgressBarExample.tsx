import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import ProgressBar from 'widget/components/progress-bar/ProgressBar.tsx';

interface ProgressBarExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

export default function ProgressBarExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: ProgressBarExampleProps) {
  const [progressValue, setProgressValue] = useState(42);

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>ProgressBar</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Значение&nbsp;
          <input
            type="range"
            min={0}
            max={100}
            value={progressValue}
            onInput={event => setProgressValue(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <span style={{ color: '#888', fontSize: '13px' }}>{`${progressValue}%`}</span>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ProgressBar value={progressValue} ariaLabel="Демонстрационный прогресс" />
      </div>
    </section>
  );
}
