// Пример использования:
/*
const factory = new SimpleConversationFactory({
    openaiApiKey: process.env.OPENAI_API_KEY
});

const logFunction: LogFunction = async (message, type) => {
    console.log(`[${type}]`, message);
};

const conversation = factory.create(ServiceType.OPENAI, "gpt-4o", logFunction);

const messages: ContentBlock[] = [
    {
        type: ContentType.TEXT,
        data: { role: "user", content: "Hello!" }
    }
];

for await (const event of conversation.send(messages, { stream: true })) {
    if (event.type === StreamEventType.TEXT_DELTA) {
        console.log(`[${event.tokens} tokens]`, event.content);
    }
}
*/