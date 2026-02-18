import { type JSX } from 'preact/jsx-runtime';
import ChatContainer, { type ChatContainerProps } from 'widget/components/chat/ChatContainer.tsx';

interface ChatContainerExampleProps {
  sectionStyle: JSX.CSSProperties;
  badgeStyle: JSX.CSSProperties;
}

const chatDemoMessages: ChatContainerProps['messages'] = [
  {
    id: 'assistant-welcome',
    type: 'assistant',
    content: 'Здравствуйте! Я помогу разобраться с возможностями платформы. С чего начнём?',
    timestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    id: 'user-question',
    type: 'user',
    content: 'Привет!',
    timestamp: Date.now() - 1000 * 60 * 4,
  },
  {
    id: 'assistant-answer',
    type: 'assistant',
    content: 'Конечно. Ниже — пара сообщений с конфигурацией по умолчанию и Markdown для контента.',
    timestamp: Date.now() - 1000 * 60 * 3,
  },
  {
    id: 'user-followup',
    type: 'user',
    content: 'Отлично, так понятнее. Добавим ещё пару ответов и можно тестировать поведение.',
    timestamp: Date.now() - 1000 * 60 * 2,
  },
];

export default function ChatContainerExample({
  sectionStyle,
  badgeStyle,
}: ChatContainerExampleProps) {
  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>ChatContainer</h2>
        <span style={badgeStyle}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#10b981' }} />
          dumb component
        </span>
      </div>

      <p style={{ marginTop: '12px', marginBottom: '16px', color: '#666', fontSize: '14px' }}>
        Рыбный диалог помогает быстро проверить отрисовку пузырей, скролл и базовые состояния чата.
      </p>

      <div style={{ height: '220px' }}>
        <ChatContainer
          messages={chatDemoMessages}
          isLoading={false}
          currentResponse=""
          descriptionText="Сообщения появятся здесь, как только пользователь начнёт диалог."
        />
      </div>
    </section>
  );
}
