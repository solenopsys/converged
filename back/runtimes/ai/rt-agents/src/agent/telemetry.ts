import { createTelemetryServiceClient } from "g-telemetry";

const DEV = process.env.NODE_ENV !== "production";

function ts() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export class AgentLogger {
  private readonly client = createTelemetryServiceClient({ baseUrl: process.env.SERVICES_BASE });

  sessionStart(sessionId: string, model: string): number {
    console.log(`${ts()} [agent] START  session=${sessionId} model=${model}`);
    return Date.now();
  }

  iterationStart(sessionId: string, iteration: number, max: number): void {
    console.log(`${ts()} [agent] ITER   ${iteration}/${max} session=${sessionId}`);
  }

  llmStart(sessionId: string, model: string): number {
    if (DEV) console.log(`${ts()} [agent] LLM→   model=${model}`);
    return Date.now();
  }

  llmEnd(sessionId: string, startedAt: number, tokens: { input: number; output: number }): void {
    const ms = Date.now() - startedAt;
    console.log(`${ts()} [agent] LLM←   ${ms}ms  in=${tokens.input} out=${tokens.output}`);
    this.metric(sessionId, "llm.durationMs", ms, "ms");
    this.metric(sessionId, "llm.tokensInput", tokens.input, "tokens");
    this.metric(sessionId, "llm.tokensOutput", tokens.output, "tokens");
  }

  toolStart(sessionId: string, name: string): number {
    console.log(`${ts()} [agent] TOOL→  ${name}`);
    return Date.now();
  }

  toolEnd(sessionId: string, name: string, startedAt: number, isError: boolean): void {
    const ms = Date.now() - startedAt;
    console.log(`${ts()} [agent] TOOL←  ${name} ${ms}ms ${isError ? "ERROR" : "OK"}`);
    this.metric(sessionId, `tool.${name}.durationMs`, ms, "ms");
  }

  sessionComplete(sessionId: string, startedAt: number, iterations: number, tokens: { input: number; output: number }): void {
    const ms = Date.now() - startedAt;
    console.log(`${ts()} [agent] DONE   session=${sessionId} ${ms}ms iter=${iterations} tokens=${tokens.input + tokens.output}`);
    this.metric(sessionId, "session.durationMs", ms, "ms");
    this.metric(sessionId, "session.iterations", iterations, "count");
    this.metric(sessionId, "session.tokens", tokens.input + tokens.output, "tokens");
  }

  sessionError(sessionId: string, message: string, step: string): void {
    console.error(`${ts()} [agent] ERROR  session=${sessionId} step=${step}: ${message}`);
  }

  private metric(sessionId: string, param: string, value: number, unit?: string): void {
    this.client.write({ device_id: sessionId, param, value, unit }).catch(() => {});
  }
}
