// wf-dialogue-summary — flow only. Pulls chats and calls still flagged
// processed=false, builds a transcript (user messages whole, assistant replies
// clipped), asks the LLM for {title, description, flud} and writes it back,
// marking the dialogue processed. One bad dialogue lands in errors and the
// batch carries on (rt.attempt, never try/catch — the engine's yield must not
// be caught). All clients are the generated g-*/rt; the LLM goes through
// rt.llm (provider hub) — provider and model are required params, no defaults.

import { createCallsServiceRtClient } from "g-calls/rt";
import { createChatsServiceRtClient } from "g-chats/rt";
import { createThreadsServiceRtClient, MessageType } from "g-threads/rt";

const chats = createChatsServiceRtClient();
const calls = createCallsServiceRtClient();
const threads = createThreadsServiceRtClient();

const SYSTEM_PROMPT = [
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

const DEFAULTS = {

	maxMessageChars: 1024,

	limit: 50,

	maxTokens: 512,

	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & { provider: string; model: string };

type Summary = { title: string; description: string; flud: boolean };

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`);


function parseSummary(body: string): Summary {
	const cleaned = body.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1").trim();
	try {
		const parsed = JSON.parse(cleaned) as Partial<Summary>;
		const title = String(parsed.title ?? "").trim();
		const description = String(parsed.description ?? "").trim();
		if (title || description) return { title, description, flud: parsed.flud === true };
	} catch {
		// not JSON — fall through
	}
	const flat = cleaned.replace(/\s+/g, " ").trim();
	return { title: clip(flat, 60).replace(/…$/, ""), description: flat, flud: flat.length === 0 };
}

rt.workflow = (input: Input) => {
	if (!input?.provider || !input?.model) {
		throw new Error("dialogue-summary requires params.provider and params.model");
	}
	const o = { ...DEFAULTS, ...input };
	const line = (who: string, text: string, assistant: boolean) =>
		`${assistant ? "Assistant" : "User"}: ${assistant ? clip(text, o.maxMessageChars) : text}`;

	const rooms = rt.node("list-chats", () => chats.listRooms({ offset: 0, limit: o.limit, processed: false }));
	const callList = rt.node("list-calls", () => calls.listCalls({ offset: 0, limit: o.limit, processed: false }));

	const dialogues = [
		...rooms.items.map((r) => ({ kind: "chat" as const, id: r.id, threadId: r.threadId as string | undefined })),
		...callList.items.map((c) => ({ kind: "call" as const, id: c.id, threadId: c.threadId })),
	];

	const items: Record<string, unknown>[] = [];
	let updated = 0;
	let skipped = 0;

	for (const ref of dialogues) {
		const key = `${ref.kind}-${ref.id}`;

		// transcript: chat → thread messages, call → recognized dialogue
		const got = rt.attempt(`read:${key}`, () => {
			if (ref.kind === "call") {
				return calls.getDialogue(ref.id).map((d) => line(d.who, d.text.trim(), d.who === "assistant"));
			}
			if (!ref.threadId) return [];
			return threads
				.readThread(ref.threadId)
				.filter((m) => m.type === MessageType.message && (m.data ?? "").trim())
				.map((m) => line(m.user, m.data.trim(), m.user === "assistant"));
		});
		if (!got.ok) {
			items.push({ kind: ref.kind, id: ref.id, status: "error", error: got.error });
			continue;
		}
		const transcript = got.value.filter(Boolean).join("\n");
		if (!transcript.trim()) {
			skipped += 1;
			items.push({ kind: ref.kind, id: ref.id, status: "skipped-empty" });
			continue;
		}

		const answered = rt.attempt(`llm:${key}`, () =>
			rt.llm({
				provider: o.provider,
				model: o.model,
				maxTokens: o.maxTokens,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: transcript },
				],
			}),
		);
		if (!answered.ok) {
			items.push({ kind: ref.kind, id: ref.id, status: "error", error: answered.error });
			continue;
		}
		const summary = parseSummary(answered.value.text);

		if (!o.dryRun) {
			const patch = {
				title: summary.title || undefined,
				description: summary.description || undefined,
				processed: true,
				flud: summary.flud,
			};
			const persisted = rt.attempt(`persist:${key}`, () =>
				ref.kind === "chat" ? chats.updateRoom(ref.id, patch) : calls.updateCall(ref.id, patch),
			);
			if (!persisted.ok) {
				items.push({ kind: ref.kind, id: ref.id, status: "error", error: persisted.error });
				continue;
			}
		}

		updated += 1;
		items.push({ kind: ref.kind, id: ref.id, status: o.dryRun ? "dry-run" : "updated", ...summary });
	}

	const result = { total: dialogues.length, updated, skipped, items };
	rt.set("dialogue-summary:last-result", result);
	rt.log(`dialogue-summary: total=${result.total} updated=${updated} skipped=${skipped}`);
	return result;
};
