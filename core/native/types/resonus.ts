/** Gateway commands are opaque to the transport; their payload is validated by
 * the Resonus domain handler after the generated auth wrapper. */
export interface RuntimeResonusService {
  "call.offer"(payload: Record<string, unknown>): Promise<unknown>;
  "call.hangup"(payload: Record<string, unknown>): Promise<unknown>;
  "call.ice"(payload: Record<string, unknown>): Promise<unknown>;
  "chat.message"(payload: Record<string, unknown>): Promise<unknown>;
  "session.open"(payload: Record<string, unknown>): Promise<unknown>;
  "session.bind"(payload: Record<string, unknown>): Promise<unknown>;
  "session.close"(payload: Record<string, unknown>): Promise<unknown>;
  "message.put"(payload: Record<string, unknown>): Promise<unknown>;
  "context.create"(payload: Record<string, unknown>): Promise<unknown>;
  "context.replace"(payload: Record<string, unknown>): Promise<unknown>;
  "context.delete"(payload: Record<string, unknown>): Promise<unknown>;
  "llm.generate"(payload: Record<string, unknown>): Promise<unknown>;
  "dictation.start"(payload: Record<string, unknown>): Promise<unknown>;
  "dictation.stop"(payload: Record<string, unknown>): Promise<unknown>;
}
