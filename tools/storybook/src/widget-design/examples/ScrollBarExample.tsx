import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import ScrollBar from 'widget/components/scroll-bar/ScrollBar.tsx';

interface ScrollBarExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

export default function ScrollBarExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: ScrollBarExampleProps) {
  const [scrollValue, setScrollValue] = useState(50);

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>ScrollBar</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Значение&nbsp;
          <input
            type="number"
            min={0}
            max={100}
            value={scrollValue}
            onInput={event => setScrollValue(Number((event.currentTarget as HTMLInputElement).value))}
            style={{ width: '80px' }}
          />
        </label>
        <label>
          Позиция&nbsp;
          <input
            type="range"
            min={0}
            max={100}
            value={scrollValue}
            onInput={event => setScrollValue(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <span style={{ color: '#888', fontSize: '13px' }}>{`${scrollValue}%`}</span>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ScrollBar
          value={scrollValue}
          onValueChange={setScrollValue}
          ariaLabel="Демонстрационная прокрутка"
        />
      </div>
    </section>
  );
}
