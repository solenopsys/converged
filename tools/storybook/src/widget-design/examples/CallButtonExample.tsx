import { type JSX } from 'preact/jsx-runtime';
import CallButton from 'widget/components/call-button/CallButton.tsx';

interface CallButtonExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
}

export default function CallButtonExample({
  sectionStyle,
  badgeStyle,
}: CallButtonExampleProps) {
  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>CallButton</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#f97316' }} />
          smart component
        </span>
      </div>

      <p style={{ marginTop: '16px', marginBottom: '16px', color: '#666', fontSize: '13px' }}>
        Нажмите кнопку, чтобы инициировать WebRTC звонок. Для полноценной проверки требуется рабочий backend,
        доступный по маршруту <code>/ws</code>.
      </p>

      <CallButton />
    </section>
  );
}
