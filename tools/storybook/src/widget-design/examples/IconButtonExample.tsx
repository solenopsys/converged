import { useState } from 'preact/hooks';
import { type JSX } from 'preact/jsx-runtime';
import { Bot, Loader2, MessageCircle } from 'lucide-preact';
import { ButtonSize, IconButton } from 'widget/components/icon-button/IconButton.tsx';

interface IconButtonExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
  controlsStyle: JSX.CSSProperties;
}

type IconKey = 'message' | 'bot' | 'loader';

const icons: Record<IconKey, any> = {
  message: MessageCircle,
  bot: Bot,
  loader: Loader2,
};

const sizeOptions: Array<{ value: ButtonSize; label: string }> = [
  { value: ButtonSize.Small, label: 'Small (40px)' },
  { value: ButtonSize.Medium, label: 'Medium (48px)' },
  { value: ButtonSize.Large, label: 'Large (56px)' },
];

const iconOptions: IconKey[] = ['message', 'bot', 'loader'];

export default function IconButtonExample({
  sectionStyle,
  badgeStyle,
  controlsStyle,
}: IconButtonExampleProps) {
  const [buttonSize, setButtonSize] = useState<ButtonSize>(ButtonSize.Medium);
  const [iconKey, setIconKey] = useState<IconKey>('message');

  const SelectedIcon = icons[iconKey];

  const handleButtonClick = () => {
    const currentIndex = iconOptions.indexOf(iconKey);
    const nextIcon = iconOptions[(currentIndex + 1) % iconOptions.length];
    setIconKey(nextIcon);
  };

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>IconButton</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <div style={controlsStyle}>
        <label>
          Размер&nbsp;
          <select
            value={buttonSize}
            onChange={event => setButtonSize(Number(event.currentTarget.value) as ButtonSize)}
          >
            {sizeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Иконка&nbsp;
          <select value={iconKey} onChange={event => setIconKey(event.currentTarget.value as IconKey)}>
            {iconOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <span style={{ color: '#888', fontSize: '13px' }}>Клик по кнопке переключает иконку</span>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '18px', alignItems: 'center' }}>
        <IconButton
          size={buttonSize}
          icon={SelectedIcon}
          onClick={handleButtonClick}
          ariaLabel="Сменить иконку"
        />
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          Нет сложной логики — только внешний вид и базовые пропсы.
        </p>
      </div>
    </section>
  );
}
