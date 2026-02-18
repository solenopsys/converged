import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatDetail } from "mf-assistants";

const meta = {
  title: "Components/ChatDetail",
  component: ChatDetail,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "600px", background: "hsl(var(--background))" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleMessages = [
  {
    id: "1",
    type: "user" as const,
    content: "hi",
    timestamp: Date.now() - 60000,
  },
  {
    id: "2",
    type: "assistant" as const,
    content: "Hello! How can I assist you today?",
    timestamp: Date.now() - 55000,
  },
  {
    id: "3",
    type: "user" as const,
    content: "расскажи про крупные звезды",
    timestamp: Date.now() - 30000,
  },
  {
    id: "4",
    type: "assistant" as const,
    content: `Крупные звезды - это тип звезд, который отличается от обычных звезд своими гигантскими размерами и массой. Такие звезды обладают большим запасом ядерного топлива и горят ярче и дольше, чем обычные звезды.

Одной из самых известных крупных звезд является Betelgeuse, которая является красным сверхгигантом и входит в состав созвездия Ориона. Ее диаметр составляет около 900 раз больше диаметра Солнца.

Другой знаменитой крупной звездой является Ви-Сентавр, одна из самых крупных известных звезд. Она также классифицируется как красный сверхгигант и находится на расстоянии около 1 390 световых лет от Земли.

Крупные звезды играют важную роль в развитии и эволюции вселенной, поскольку они производят большие количества элементов, необходимых для жизни, и в конечном итоге могут сделаться черными дырами или взорваться в виде сверхновых.`,
    timestamp: Date.now() - 25000,
  },
];

export const Default: Story = {
  args: {
    messages: sampleMessages,
    isLoading: false,
    currentResponse: "",
    send: (content: string) => console.log("Send:", content),
    showComposer: true,
  },
};

export const Loading: Story = {
  args: {
    messages: sampleMessages.slice(0, 3),
    isLoading: true,
    currentResponse: "",
    send: (content: string) => console.log("Send:", content),
    showComposer: true,
  },
};

export const Streaming: Story = {
  args: {
    messages: sampleMessages.slice(0, 3),
    isLoading: true,
    currentResponse: "Крупные звезды - это тип звезд, который отличается от обычных звезд своими гигантскими размерами и массой...",
    send: (content: string) => console.log("Send:", content),
    showComposer: true,
  },
};

export const WithMarkdown: Story = {
  args: {
    messages: [
      {
        id: "1",
        type: "user" as const,
        content: "покажи пример markdown",
        timestamp: Date.now() - 60000,
      },
      {
        id: "2",
        type: "assistant" as const,
        content: `# Заголовок 1

## Заголовок 2

### Заголовок 3

Обычный текст с **жирным** и *курсивом*.

Список:
- Первый пункт
- Второй пункт
- Третий пункт

Нумерованный список:
1. Один
2. Два
3. Три

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

> Это цитата

Инлайн код: \`npm install\`

| Колонка 1 | Колонка 2 |
|-----------|-----------|
| Ячейка 1  | Ячейка 2  |
| Ячейка 3  | Ячейка 4  |
`,
        timestamp: Date.now() - 55000,
      },
    ],
    isLoading: false,
    currentResponse: "",
    send: (content: string) => console.log("Send:", content),
    showComposer: true,
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    isLoading: false,
    currentResponse: "",
    send: (content: string) => console.log("Send:", content),
    showComposer: true,
  },
};

export const NoComposer: Story = {
  args: {
    messages: sampleMessages,
    isLoading: false,
    currentResponse: "",
    send: (content: string) => console.log("Send:", content),
    showComposer: false,
  },
};
