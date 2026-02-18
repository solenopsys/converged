import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import ChatInput from 'widget/components/input/ChatInput.tsx';

interface ChatInputExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

export default function ChatInputExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: ChatInputExampleProps) {
  const [chatText, setChatText] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatMulti, setChatMulti] = useState(false);
  const [sentMessages, setSentMessages] = useState<string[]>([]);

  const handleSend = (message: string) => {
    setSentMessages(prev => [message, ...prev].slice(0, 5));
  };

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>ChatInput</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Текст по умолчанию&nbsp;
          <input
            value={chatText}
            onInput={event => setChatText((event.currentTarget as HTMLInputElement).value)}
            style={{ width: '260px' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={chatEnabled}
            onChange={event => setChatEnabled(event.currentTarget.checked)}
          />
          canSend
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={chatMulti}
            onChange={event => setChatMulti(event.currentTarget.checked)}
          />
          multi
        </label>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ChatInput
          userText={chatText}
          setUserText={setChatText}
          onSendMessage={handleSend}
          canSend={chatEnabled}
          isMulti={chatMulti}
        />
      </div>

      {sentMessages.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>Последние отправленные сообщения</h3>
          <ul style={{ paddingLeft: '20px', margin: 0, color: '#444', fontSize: '14px' }}>
            {sentMessages.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
