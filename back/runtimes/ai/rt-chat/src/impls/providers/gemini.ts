import { randomUUID } from "crypto";
import { BaseConversation } from "../conversation";
import { EventHandler } from "../hendler";
import {
    StreamEvent,
    LogFunction,
    ConversationOptions,
    ContentBlock,
    ContentType,
    Tool,
    StreamEventType
} from "../../types";
import type { GoogleGenAI } from "@google/genai";

// Обработчик текстовых дельт
class GeminiTextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "text_delta";
    }

    handle(event: any, totalTokens: number): StreamEvent | null {
        const parts = event.candidates?.[0]?.content?.parts;
        if (!parts) return null;

        const textParts = parts.filter((p: any) => p.text);
        if (textParts.length === 0) return null;

        return {
            type: StreamEventType.TEXT_DELTA,
            content: textParts.map((p: any) => p.text).join(""),
            tokens: totalTokens
        };
    }
}

// Обработчик вызовов функций
class GeminiToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "function_call";
    }

    handle(event: any, totalTokens: number): StreamEvent | null {
        const parts = event.candidates?.[0]?.content?.parts;
        if (!parts) return null;

        const fcPart = parts.find((p: any) => p.functionCall);
        if (!fcPart) return null;

        return {
            type: StreamEventType.TOOL_CALL,
            id: fcPart.functionCall.id || randomUUID(),
            name: fcPart.functionCall.name || "",
            args: fcPart.functionCall.args || {},
            tokens: totalTokens
        };
    }
}

// Обработчик завершения
class GeminiCompletionHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "done";
    }

    handle(event: any, totalTokens: number): StreamEvent {
        return {
            type: StreamEventType.COMPLETED,
            finishReason: event.candidates?.[0]?.finishReason || "stop",
            tokens: totalTokens
        };
    }
}

export class GeminiConversation extends BaseConversation {
    private ai: GoogleGenAI;
    private currentContent: any[] = [];

    constructor(model: string, client: GoogleGenAI, log: LogFunction) {
        super(model, log);
        this.ai = client;
    }

    protected initializeHandlers(): void {
        this.handlers = [
            new GeminiTextDeltaHandler(this),
            new GeminiToolCallHandler(this),
            new GeminiCompletionHandler(this),
        ];
    }

    protected getEventType(event: any): string {
        const parts = event.candidates?.[0]?.content?.parts || [];
        const hasFunction = parts.some((p: any) => p.functionCall);
        const hasText = parts.some((p: any) => p.text);
        const finishReason = event.candidates?.[0]?.finishReason;

        if (hasFunction) return "function_call";
        if (hasText) return "text_delta";
        if (finishReason) return "done";
        return "unknown";
    }

    protected extractTokensFromEvent(event: any): number {
        const u = event.usageMetadata;
        if (!u) return 0;
        return (u.promptTokenCount || 0) + (u.candidatesTokenCount || 0);
    }

    protected isTerminalEvent(result: StreamEvent): boolean {
        return result.type === StreamEventType.COMPLETED || result.type === StreamEventType.ERROR;
    }

    protected convertToolToProviderFormat(tool: Tool): any {
        return {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        };
    }

    protected convertToProviderFormat(messages: ContentBlock[]): any[] {
        const contents: any[] = [];

        for (const msg of messages) {
            if (msg.type === ContentType.TOOL_RESULT || msg.type === "tool_result") {
                const d = msg.data as any;
                contents.push({
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: d.name || d.tool_name || "",
                            response: {
                                result: typeof d.data === "string" ? d.data : JSON.stringify(d.data || d)
                            },
                            id: d.tool_call_id || (msg as any).tool_call_id
                        }
                    }]
                });
                continue;
            }

            if (typeof msg.data === "string") {
                contents.push({ role: "user", parts: [{ text: msg.data }] });
                continue;
            }

            if (typeof msg.data === "object" && msg.data !== null) {
                const d = msg.data as any;
                const role = d.role === "assistant" ? "model" : "user";

                if (d.tool_calls) {
                    const parts: any[] = [];
                    if (d.content && typeof d.content === "string") {
                        parts.push({ text: d.content });
                    }
                    for (const tc of d.tool_calls) {
                        parts.push({
                            functionCall: {
                                name: tc.function?.name || tc.name,
                                args: typeof tc.function?.arguments === "string"
                                    ? JSON.parse(tc.function.arguments)
                                    : tc.function?.arguments || tc.args || {},
                                id: tc.id
                            }
                        });
                    }
                    contents.push({ role: "model", parts });
                } else {
                    const text = d.content || "";
                    contents.push({
                        role,
                        parts: [{ text: typeof text === "string" ? text : JSON.stringify(text) }]
                    });
                }
            }
        }

        return contents;
    }

    protected async createStream(messages: any[], options?: ConversationOptions): Promise<any> {
        const systemMessages = messages.filter((m: any) => m.role === "system");
        const conversationMessages = messages.filter((m: any) => m.role !== "system");

        const config: any = {
            temperature: options?.temperature,
            maxOutputTokens: options?.maxTokens,
            topP: options?.top_p,
            topK: options?.top_k,
        };

        if (systemMessages.length > 0) {
            config.systemInstruction = systemMessages[0].parts?.[0]?.text || systemMessages[0].content;
        }

        if (options?.tools && options.tools.length > 0) {
            config.tools = [{
                functionDeclarations: options.tools.map(t => this.convertToolToProviderFormat(t))
            }];
        }

        const response = await this.ai.models.generateContentStream({
            model: this.model,
            contents: conversationMessages,
            config
        });

        return this.ensureCompletion(response);
    }

    private async *ensureCompletion(response: any): AsyncIterable<any> {
        let lastChunk: any = null;
        for await (const chunk of response) {
            yield chunk;
            lastChunk = chunk;
        }
        // Gemini отдаёт finishReason в последнем чанке вместе с контентом.
        // Base class ожидает отдельный terminal event.
        // Если последний чанк содержал контент — шлём пустой чанк с finishReason.
        const lastParts = lastChunk?.candidates?.[0]?.content?.parts || [];
        const hasContent = lastParts.some((p: any) => p.text || p.functionCall);
        const finishReason = lastChunk?.candidates?.[0]?.finishReason;
        if (hasContent && finishReason) {
            yield { candidates: [{ finishReason, content: { parts: [] } }], usageMetadata: lastChunk.usageMetadata };
        }
    }

    protected async processStreamEvent(event: any, totalTokens: number): Promise<void> {
        const parts = event.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.text) {
                const last = this.currentContent[this.currentContent.length - 1];
                if (last?.type === "text") {
                    last.text += part.text;
                } else {
                    this.currentContent.push({ type: "text", text: part.text });
                }
            }
            if (part.functionCall) {
                this.currentContent.push({ type: "functionCall", functionCall: part.functionCall });
            }
        }

        const finishReason = event.candidates?.[0]?.finishReason;
        if (finishReason && this.currentContent.length > 0) {
            this.addToHistory({
                role: "model",
                parts: this.currentContent.map(c =>
                    c.type === "text" ? { text: c.text } : { functionCall: c.functionCall }
                )
            });
            this.currentContent = [];
        }
    }
}
