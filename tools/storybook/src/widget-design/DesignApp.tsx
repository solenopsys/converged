import { type JSX } from 'preact/jsx-runtime';
import DesignContainer from './components/DesignContainer.tsx';
import ProgressBarExample from './examples/ProgressBarExample.tsx';
import ScrollBarExample from './examples/ScrollBarExample.tsx';
import IconButtonExample from './examples/IconButtonExample.tsx';
import ChatInputExample from './examples/ChatInputExample.tsx';
import ChatContainerExample from './examples/ChatContainerExample.tsx';
import MessageBubbleExample from './examples/MessageBubbleExample.tsx';
import TypographyMarkdownExample from './examples/TypographyMarkdownExample.tsx';
import FileViewExample from './examples/FileViewExample.tsx';
import FileListExample from './examples/FileListExample.tsx';
import CallButtonExample from './examples/CallButtonExample.tsx';

const sectionStyle: JSX.CSSProperties = {
  background: '#fff',
  padding: '20px',
  borderRadius: '12px',
  boxShadow: '0 6px 18px rgba(0,0,0,0.07)',
  marginBottom: '24px',
  maxWidth: '440px',
};

const controlsStyle: JSX.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  marginTop: '12px',
  alignItems: 'center',
};

const badgeStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  color: '#666',
};

export default function DesignApp() {
  return (
    <DesignContainer>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Design Playground</h1>
        <p style={{ marginTop: '8px', color: '#444', maxWidth: '640px' }}>
          Быстрый просмотр «глупых» компонентов с минимальными настройками. Используйте контролы ниже, чтобы
          проверить стили и поведение без запуска всего виджета.
        </p>
      </header>

      <CallButtonExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
      />
      <ProgressBarExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <ScrollBarExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <IconButtonExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <ChatInputExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <ChatContainerExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
      />
      <MessageBubbleExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <TypographyMarkdownExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
      />
      <FileViewExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
      <FileListExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </DesignContainer>
  );
}
