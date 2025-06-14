/* proxy-plugin.ts
   ───────────────────────────────────────────────────────────────
   Elysia **plugin** which forwards /api/responses requests to
   OpenAI **Responses API** with full Server‑Sent‑Events streaming.
   All user messages and every SSE event from OpenAI are forwarded
   to an injected LogService implementation, so the proxy itself
   remains stateless.
   ─────────────────────────────────────────────────────────────── */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import type { ContentBlock, LogService } from "./types";
import { LogServiceHub } from "./log/log-service-hub";
import { LogServiceConsole } from "./log/log-service-console";
import { LogServiceSQLite } from "./log/log-service-sqlite";

/* ───────── 0.  DI‑точка (подмените реальной реализацией) ───────── */
const log: LogService = new LogServiceHub();

// 👉 Добавляем конкретные реализации
log.add(new LogServiceConsole());
log.add(new LogServiceSQLite());

/* ───────── 1.  Конфигурация OpenAI ───────── */
const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "gpt-4o";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* helper: простая строка → ContentBlock[] */
const toBlocks = (text: string): ContentBlock[] => [
	{ type: "text", text, annotations: [] },
];

/*
 * ────────────────────────────────────────────────────────────────
 *  PLUGIN FACTORY
 *
 *  Использование:
 *    import { Elysia } from "elysia"
 *    import responsesProxy from "./proxy-plugin"
 *
 *    const app = new Elysia()
 *      .use(responsesProxy)
 *      .listen(3000)
 * ────────────────────────────────────────────────────────────────
 */
export const responsesProxyPlugin = (app: Elysia) =>
	app
		.use(cors())

		/* 2.1  Streaming‑proxy для /api/responses */
		.post("/api/responses", async ({ body, set, request }) => {
			try {
				const {
					input,
					model = DEFAULT_MODEL,
					previous_response_id,
					truncation = "auto",
					...extra
				} = body as {
					input: { role: string; content: string }[];
					model?: string;
					previous_response_id?: string;
					truncation?: "auto" | "disabled";
					[k: string]: unknown;
				};

				if (!Array.isArray(input)) {
					set.status = 400;
					return { error: "'input' must be an array of messages" };
				}

				/* conversationId: либо previous_response_id, либо fresh uuid */
				const conversationId =
					typeof previous_response_id === "string"
						? previous_response_id
						: randomUUID();

				/* 2.1.1  Логируем ВСЕ реплики пользователя */
				await Promise.all(
					input.map((m) =>
						log.saveUserMessage({
							conversationId,
							role: "user",
							content: toBlocks(m.content),
							model,
							timestamp: new Date(),
							meta: {
								ip: request.headers.get("x-forwarded-for") ?? undefined,
							},
						}),
					),
				);

				/* 2.1.2  Запрос к OpenAI со стримингом */
				const stream = await openai.responses.create({
					model,
					input,
					stream: true,
					previous_response_id,
					truncation,
					...extra,
				});

				/* 2.1.3  SSE‑заголовки */
				set.headers = {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				};

				const encoder = new TextEncoder();

				return new ReadableStream({
					async start(controller) {
						for await (const ev of stream) {
							const type = (ev as any).type ?? "unknown";

							/* 1) отдаём клиенту */
							controller.enqueue(
								encoder.encode(
									`event: ${type}\n` + `data: ${JSON.stringify(ev)}\n\n`,
								),
							);

							/* 2) передаём в лог‑сервис (fire‑and‑forget) */
							void log.saveOpenAIEvent({
								conversationId,
								model,
								event: {
									type,
									payload: ev,
									receivedAt: new Date(),
								},
							});

							/* закрываем SSE после сигнала completed/done */
							if (type === "response.completed" || type === "done") {
								controller.enqueue(
									encoder.encode(`event: done\ndata: [DONE]\n\n`),
								);
								controller.close();
							}
						}
					},
				});
			} catch (err: any) {
				set.status = 500;
				return { error: err?.message ?? "Internal Server Error" };
			}
		})

		/* 2.2  Helper: создать realtime‑сессию OpenAI */
		.get("/api/session", async ({ set }) => {
			try {
				const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ model: DEFAULT_MODEL }),
				});
				return await r.json();
			} catch {
				set.status = 500;
				return { error: "Unable to create session" };
			}
		})

		/* 2.3  Health‑check */
		.get("/api", () => "OpenAI Responses proxy is up!");

export default responsesProxyPlugin;
