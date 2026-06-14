import type { INode, Provider } from "@rt/dag-api";
import { getProvidersPool } from "@rt/providers";
import { createCallsServiceClient } from "g-calls";
import { createChatsServiceClient } from "g-chats";
import { createThreadsServiceClient, MessageType } from "g-threads";

/**
 * Default per-message byte budget for the assistant side of a transcript.
 * User messages are kept whole; assistant replies are clipped so a long
 * agent monologue can't blow up the prompt. Overridable via
 * `DIALOGUE_SUMMARY_MAX_MESSAGE_BYTES` or the `maxMessageBytes` param.
 */
const DEFAULT_MAX_MESSAGE_BYTES = 1024;
const DEFAULT_LIMIT = 50;
const DEFAULT_PROVIDER = "openai";

const SUMMARY_SYSTEM_PROMPT = [
  "You summarize a conversation between a user and an assistant.",
  "Produce a short, specific title (no more than ~60 characters) and a concise",
  "description (1-3 sentences) capturing the topic, the user's intent and the",
  "outcome. Write in the same language the dialogue is in.",
  'Also set "flud" (noise): true when the conversation carried no useful',
  "payload — it was empty, pointless, the user never stated a real request, or",
  "it ended with nothing meaningful (e.g. only a greeting or a stray reply);",
  "false when there was a genuine topic, request or outcome.",
  'Respond with ONLY a JSON object: {"title": string, "description": string, "flud": boolean}.',
  "Do not wrap it in markdown fences or add any extra text.",
].join(" ");

export type DialogueSummaryParams = {
  /** Registered LLM provider name. Defaults to env / "openai". */
  provider?: string;
  /** Specific provider model to use (e.g. "gpt-4o-mini", "gemini-3-flash").
   * Defaults to env / the provider's own configured model. */
  model?: string;
  /** Byte cap applied to each assistant message. Defaults to env / 1024. */
  maxMessageBytes?: number;
  /** Max dialogues of each kind to pull per run. Defaults to 50. */
  limit?: number;
  /** Base URL for the nrpc service clients (defaults to the runtime's). */
  servicesBaseUrl?: string;
  /** When true, compute summaries but do not write them back. */
  dryRun?: boolean;
};

export type DialogueKind = "chat" | "call";

export type DialogueRef = {
  kind: DialogueKind;
  id: string;
  threadId?: string;
  phone?: string;
};

export type DialogueSummary = {
  title: string;
  description: string;
  /** True when the dialogue is noise — no useful/positive payload. */
  flud: boolean;
};

function resolveProvider(params: DialogueSummaryParams): string {
  return (
    params.provider ??
    process.env.DIALOGUE_SUMMARY_PROVIDER ??
    DEFAULT_PROVIDER
  );
}

/** Specific model name, or undefined to fall back to the provider's default. */
function resolveModel(params: DialogueSummaryParams): string | undefined {
  return params.model ?? process.env.DIALOGUE_SUMMARY_MODEL ?? undefined;
}

function resolveMaxMessageBytes(params: DialogueSummaryParams): number {
  if (typeof params.maxMessageBytes === "number" && params.maxMessageBytes > 0) {
    return params.maxMessageBytes;
  }
  const fromEnv = Number(process.env.DIALOGUE_SUMMARY_MAX_MESSAGE_BYTES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_MAX_MESSAGE_BYTES;
}

function resolveLimit(params: DialogueSummaryParams): number {
  if (typeof params.limit === "number" && params.limit > 0) {
    return params.limit;
  }
  return DEFAULT_LIMIT;
}

/** Clip a string to at most `maxBytes` UTF-8 bytes, appending an ellipsis. */
function truncateBytes(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return text;
  }
  // Decode the prefix loosely so a split multibyte char doesn't throw.
  const clipped = new TextDecoder("utf8").decode(buf.subarray(0, maxBytes));
  return `${clipped.trimEnd()}…`;
}

/** Collects chats and calls that have not been summarized yet. */
export class DialogueSummaryCollectNode implements INode {
  constructor(public name: string) {}

  async execute(
    params: DialogueSummaryParams,
  ): Promise<{ dialogues: DialogueRef[] }> {
    const limit = resolveLimit(params);
    const chats = createChatsServiceClient({ baseUrl: params.servicesBaseUrl });
    const calls = createCallsServiceClient({ baseUrl: params.servicesBaseUrl });

    const [rooms, callList] = await Promise.all([
      chats.listRooms({ offset: 0, limit, processed: false }),
      calls.listCalls({ offset: 0, limit, processed: false }),
    ]);

    const dialogues: DialogueRef[] = [
      ...rooms.items.map((room) => ({
        kind: "chat" as const,
        id: room.id,
        threadId: room.threadId,
      })),
      ...callList.items.map((call) => ({
        kind: "call" as const,
        id: call.id,
        threadId: call.threadId,
        phone: call.phone,
      })),
    ];

    return { dialogues };
  }
}

/** Builds a truncated transcript and asks the LLM for a title + description. */
export class DialogueSummarizeNode implements INode {
  constructor(public name: string) {}

  async execute(data: {
    ref: DialogueRef;
    params: DialogueSummaryParams;
  }): Promise<{ summary: DialogueSummary; skipped: boolean }> {
    const { ref, params } = data;
    const maxBytes = resolveMaxMessageBytes(params);
    const transcript = await this.buildTranscript(ref, params, maxBytes);

    if (!transcript.trim()) {
      return {
        summary: { title: "", description: "", flud: true },
        skipped: true,
      };
    }

    const providerName = resolveProvider(params);
    const provider: Provider =
      await getProvidersPool().getOrCreate(providerName);
    const { body } = await provider.invoke("request", {
      system: SUMMARY_SYSTEM_PROMPT,
      user: transcript,
      // Undefined lets the provider fall back to its configured model.
      model: resolveModel(params),
    });

    return { summary: this.parseSummary(body), skipped: false };
  }

  private async buildTranscript(
    ref: DialogueRef,
    params: DialogueSummaryParams,
    maxBytes: number,
  ): Promise<string> {
    const lines =
      ref.kind === "chat"
        ? await this.chatLines(ref, params, maxBytes)
        : await this.callLines(ref, params, maxBytes);
    return lines.join("\n");
  }

  private async chatLines(
    ref: DialogueRef,
    params: DialogueSummaryParams,
    maxBytes: number,
  ): Promise<string[]> {
    if (!ref.threadId) return [];
    const threads = createThreadsServiceClient({
      baseUrl: params.servicesBaseUrl,
    });
    const messages = await threads.readThread(ref.threadId);
    const lines: string[] = [];
    for (const message of messages) {
      if (message.type !== MessageType.message) continue;
      const text = (message.data ?? "").trim();
      if (!text) continue;
      const isAssistant = message.user === "assistant";
      lines.push(this.formatLine(isAssistant, text, maxBytes));
    }
    return lines;
  }

  private async callLines(
    ref: DialogueRef,
    params: DialogueSummaryParams,
    maxBytes: number,
  ): Promise<string[]> {
    const calls = createCallsServiceClient({ baseUrl: params.servicesBaseUrl });
    const dialogue = await calls.getDialogue(ref.id);
    const lines: string[] = [];
    for (const item of dialogue) {
      const text = (item.text ?? "").trim();
      if (!text) continue;
      const isAssistant = item.who === "assistant";
      lines.push(this.formatLine(isAssistant, text, maxBytes));
    }
    return lines;
  }

  private formatLine(
    isAssistant: boolean,
    text: string,
    maxBytes: number,
  ): string {
    const role = isAssistant ? "Assistant" : "User";
    // User messages stay whole; assistant replies are clipped.
    const body = isAssistant ? truncateBytes(text, maxBytes) : text;
    return `${role}: ${body}`;
  }

  private parseSummary(body: string): DialogueSummary {
    const cleaned = body
      .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1")
      .trim();
    try {
      const parsed = JSON.parse(cleaned) as Partial<DialogueSummary>;
      const title = (parsed.title ?? "").toString().trim();
      const description = (parsed.description ?? "").toString().trim();
      const flud = parsed.flud === true;
      if (title || description) {
        return { title, description, flud };
      }
    } catch {
      // Fall through to a best-effort summary below.
    }
    // Provider returned plain text — derive a usable title/description from it
    // and treat an unparseable / contentless reply as noise.
    const flat = cleaned.replace(/\s+/g, " ").trim();
    return {
      title: truncateBytes(flat, 60).replace(/…$/, ""),
      description: flat,
      flud: flat.length === 0,
    };
  }
}

/** Writes the generated title/description back and marks the dialogue processed. */
export class DialogueSummaryPersistNode implements INode {
  constructor(public name: string) {}

  async execute(data: {
    ref: DialogueRef;
    summary: DialogueSummary;
    params: DialogueSummaryParams;
  }): Promise<{ ref: DialogueRef; applied: boolean }> {
    const { ref, summary, params } = data;
    if (params.dryRun) {
      return { ref, applied: false };
    }

    const patch = {
      title: summary.title || undefined,
      description: summary.description || undefined,
      processed: true,
      flud: summary.flud,
    };

    if (ref.kind === "chat") {
      const chats = createChatsServiceClient({
        baseUrl: params.servicesBaseUrl,
      });
      await chats.updateRoom(ref.id, patch);
    } else {
      const calls = createCallsServiceClient({
        baseUrl: params.servicesBaseUrl,
      });
      await calls.updateCall(ref.id, patch);
    }

    return { ref, applied: true };
  }
}
