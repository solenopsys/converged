import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import MessageBubble from 'widget/components/bubble/MessageBubble.tsx';

interface MessageBubbleExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

export default function MessageBubbleExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: MessageBubbleExampleProps) {
  const [bubbleSender, setBubbleSender] = useState<'user' | 'assistant'>('assistant');
  const [bubbleText, setBubbleText] = useState('Здравствуйте! Чем я могу помочь?');
  const [bubbleBracketed, setBubbleBracketed] = useState(false);
  const [bubbleTime, setBubbleTime] = useState(() => new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date()));

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>MessageBubble</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Роль&nbsp;
          <select
            value={bubbleSender}
            onChange={event => setBubbleSender(event.currentTarget.value as 'user' | 'assistant')}
          >
            <option value="assistant">assistant</option>
            <option value="user">user</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={bubbleBracketed}
            onChange={event => setBubbleBracketed(event.currentTarget.checked)}
          />
          текст в []
        </label>

        <label>
          Время&nbsp;
          <input
            value={bubbleTime}
            onInput={event => setBubbleTime((event.currentTarget as HTMLInputElement).value)}
            style={{ width: '80px' }}
          />
        </label>
      </div>

      <div style={{ marginTop: '12px' }}>
        <textarea
          value={bubbleText}
          onInput={event => setBubbleText((event.currentTarget as HTMLTextAreaElement).value)}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(0,0,0,0.1)',
            fontFamily: 'inherit',
            fontSize: '14px',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginTop: '20px' }}>
        <MessageBubble
          sender={bubbleSender}
          text={bubbleBracketed ? `[${bubbleText}]` : bubbleText}
          timestamp={bubbleTime}
        />
      </div>
    </section>
  );
}
