/**
 * The provider descriptor contract.
 *
 * A descriptor is the whole vendor-specific part of talking to an LLM gateway.
 * It splits in two along one line: how often the thing runs.
 *
 *   - The **decode table** is data. Zig parses each vendor event once, looks the
 *     event up in a table built at load time, and copies fields by path. No JS
 *     runs per event, so nothing is parsed or serialized twice.
 *   - The **warm hooks** are functions. They run once per turn, per socket or
 *     per call — never per event — so a JS call there costs nothing measurable
 *     and buys back the expressiveness a table cannot have.
 *
 * Anything that does not fit the table goes in a hook and is referenced from the
 * table by name. That escape hatch is deliberate: the alternative is growing a
 * query language inside JSON, and every project that has tried ends up with a
 * worse JavaScript.
 */

export const API_VERSION = 1;

/**
 * A dotted path into a parsed JSON event. Numeric segments index arrays:
 * `"choices.0.delta.content"`. There are no filters, wildcards or predicates —
 * a selection that needs one belongs in a hook.
 */
export type Path = string;

/** The provider-neutral events the core understands. */
export type EmitKind =
	| "text.delta"
	| "tool_call.begin"
	| "tool_call.delta"
	| "tool_call.ready"
	| "usage"
	| "finish"
	| "fatal"
	| "turn.end"
	| "ignore"
	| "hook";

interface EmitBase {
	emit: EmitKind;
}

/** Streamed assistant text. */
export interface EmitTextDelta extends EmitBase {
	emit: "text.delta";
	text: Path;
}

/**
 * A tool call appears. `callKey` is the path to whatever the vendor uses to
 * correlate the fragments of one call — Anthropic keys by the block `index`,
 * OpenAI Realtime by `call_id`. The core keys its accumulator by that value and
 * never needs to know which convention it is.
 */
export interface EmitToolCallBegin extends EmitBase {
	emit: "tool_call.begin";
	callKey: Path;
	id?: Path;
	name?: Path;
}

/** A fragment of a tool call's arguments, as vendor-sent JSON text. */
export interface EmitToolCallDelta extends EmitBase {
	emit: "tool_call.delta";
	callKey: Path;
	argumentsText: Path;
	id?: Path;
	name?: Path;
}

/** A complete tool call delivered in one event rather than accumulated. */
export interface EmitToolCallReady extends EmitBase {
	emit: "tool_call.ready";
	id: Path;
	name: Path;
	/** JSON text of the arguments object. */
	args: Path;
}

/** Token accounting. Either field may be absent from a given event. */
export interface EmitUsage extends EmitBase {
	emit: "usage";
	inputTokens?: Path;
	outputTokens?: Path;
}

/** The turn is over; `finishReason` is passed through verbatim when present. */
export interface EmitFinish extends EmitBase {
	emit: "finish";
	finishReason?: Path;
}

/** The vendor reported an error event; the core fails the turn. */
export interface EmitFatal extends EmitBase {
	emit: "fatal";
	/** Optional path to a human-readable message for the log. */
	message?: Path;
}

/**
 * This event ends the turn.
 *
 * A session transport keeps its connection open across turns, so something has
 * to say where one stops — an HTTP body ends by itself, a WebSocket does not.
 * Place it on the vendor's terminal event, after any rule that reads values out
 * of that same event.
 */
export interface EmitTurnEnd extends EmitBase {
	emit: "turn.end";
}

/** Explicitly uninteresting. Distinct from "unknown" so silence is intentional. */
export interface EmitIgnore extends EmitBase {
	emit: "ignore";
}

/**
 * Hand the raw event to a warm hook and take back a list of uniform events.
 * Only for shapes a path cannot address — a filtered walk over an array, say.
 * Never put a per-delta event here.
 */
export interface EmitHook extends EmitBase {
	emit: "hook";
	hook: string;
}

export type Emit =
	| EmitTextDelta
	| EmitToolCallBegin
	| EmitToolCallDelta
	| EmitToolCallReady
	| EmitUsage
	| EmitFinish
	| EmitFatal
	| EmitTurnEnd
	| EmitIgnore
	| EmitHook;

/** Dispatch on a second field, for vendors that tag a subtype inside the event. */
export interface Switch {
	when: Path;
	cases: Record<string, Rule>;
	default?: Rule;
}

/** Apply a rule to every element of an array. */
export interface Each {
	each: Path;
	rule: Rule;
}

/** One event may produce several uniform events; a list is applied in order. */
export type Rule = Emit | Switch | Each | Rule[];

/**
 * How raw transport bytes become one event payload.
 *
 * SSE arrives line-wise with a `data:` prefix and a sentinel terminator;
 * a WebSocket delivers one JSON object per frame and needs neither.
 */
export interface Framing {
	/** Lines not starting with this are skipped. */
	prefix?: string;
	/** A payload equal to this ends the stream without being decoded. */
	done?: string;
}

/** The decode table: pure data, executed by the core. */
export interface DecodeTable {
	framing?: Framing;
	/**
	 * Path to the event's discriminator. Omit for vendors whose stream frames
	 * are all the same shape (OpenAI chat completions), and use `always`.
	 */
	eventType?: Path;
	/** Rules keyed by the value at `eventType`. */
	events?: Record<string, Rule>;
	/** Applied to every event, before `events`. */
	always?: Rule;
	/** Applied when `eventType` resolves to a value with no entry in `events`. */
	unknown?: Rule;
}

/** A request the core hands to `encodeTurn`, in the uniform dialect. */
export interface TurnRequest {
	model: string;
	maxTokens: number;
	temperature?: number;
	messages: UniformMessage[];
	tools: UniformTool[];
	requireTool: boolean;
}

export interface UniformMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCalls?: { id: string; name: string; args: unknown }[];
	toolCallId?: string;
	name?: string;
}

export interface UniformTool {
	name: string;
	description?: string;
	parameters?: unknown;
}

/** What an encoding hook returns: everything needed to put one request on the wire. */
export interface WireRequest {
	/** Absent for a session-oriented transport that already has its endpoint. */
	url?: string;
	method?: "POST" | "GET";
	headers?: Record<string, string>;
	/** Defaults to `application/json`. Set it for multipart or SDP bodies. */
	contentType?: string;
	body: string;
}

/**
 * Everything the core knows about a call when it negotiates media.
 *
 * Assembled from the call context, the policy plan and deployment settings, and
 * handed to `signaling.encode` as one value. `safetyIdentifier` arrives already
 * hashed: the core does that, so a raw caller number never enters the sandbox.
 */
export interface NegotiationContext {
	offerSdp: string;
	model: string;
	voice: string;
	/** The call context's prompt. Never defaulted — an absent one is refused. */
	instructions: string;
	/** `"realtime"` for a full session, `"transcription"` for a listen-only leg. */
	sessionKind: "realtime" | "transcription";
	transcription: {
		model: string;
		/** Comma-separated; empty means let the model detect. */
		languages: string;
		prompt?: string;
		keywords?: string;
		delay?: string;
	};
	noiseReduction: string;
	vad: {
		threshold: number;
		silenceMs: number;
		prefixMs: number;
		interrupt: boolean;
	};
	/** Tool declarations as JSON text, spliced verbatim when present. */
	toolsJson?: string;
	safetyIdentifier?: string;
}

/**
 * Media signaling: exchanging an SDP offer for an answer.
 *
 * A separate section from `transport` because it is a different exchange, not a
 * different vendor — the chat transport carries turns, this carries one
 * negotiation per call. The reply is opaque text (an SDP answer), so the core
 * does not try to parse it.
 */
export interface Signaling {
	url: string;
	headers?: Record<string, string>;
	/** Hook name: (NegotiationContext) => WireRequest. */
	encode: string;
	/** How the core should treat the reply body. SDP is `"text"`. */
	responseKind: "text" | "json";
}

/**
 * One step of the post-connect handshake, executed by the core in order.
 *
 * `await` blocks until an event of that type arrives; `send` puts a payload on
 * the wire. A session is not handed to the pool until every step has passed, so
 * a half-configured socket is never leased.
 */
export type HandshakeStep =
	| { await: string; timeoutMs?: number }
	| { send: string; timeoutMs?: number };

export interface Transport {
	kind: "ws" | "https";
	/**
	 * `true` when the vendor keeps conversation state on the connection, which
	 * is what makes session affinity meaningful. A stateless provider lets the
	 * pool hand any warm connection to any session.
	 */
	stateful: boolean;
	/** `${secret:name}` placeholders are substituted by the core, not by JS. */
	url: string;
	headers?: Record<string, string>;
	handshake?: HandshakeStep[];
	idlePerModel?: number;
}

/**
 * Names of the warm hooks a descriptor may export. The core resolves them as
 * `globalThis["<provider>__<hook>"]`, which the bundler emits.
 */
export interface Hooks {
	/** Uniform request -> vendor wire request. Once per turn. */
	encodeTurn?: string;
	/** Non-streaming vendor response -> uniform completion. Once per turn. */
	decodeResponse?: string;
	/** Build the payload for a handshake `send` step. Once per socket. */
	sessionConfig?: string;
	/** Referenced from the decode table by `{ emit: "hook" }`. */
	[name: string]: string | undefined;
}

export interface Descriptor {
	apiVersion: typeof API_VERSION;
	/** Registry key. Must match the file name, which the builder checks. */
	name: string;
	transport: Transport;
	decode: DecodeTable;
	/** Present only for providers that also carry a media leg. */
	signaling?: Signaling;
	/** Hook implementations, bundled into the runtime script by the builder. */
	hooks?: Record<string, (...args: never[]) => unknown>;
}

/** Helper that fixes `apiVersion` and gives descriptors their type at the source. */
export function defineProvider(d: Omit<Descriptor, "apiVersion">): Descriptor {
	return { apiVersion: API_VERSION, ...d };
}
