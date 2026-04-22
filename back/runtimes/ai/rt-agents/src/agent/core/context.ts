import type { AgentMessage } from "./types";
import type { BootstrapLoader } from "../bootstrap/loader";

export interface AgentHistoryReader {
  getHistory(sessionId: string, maxMessages: number): Promise<AgentMessage[]>;
}

export class ContextBuilder {
  constructor(
    private bootstrap: BootstrapLoader,
    private sessionManager: AgentHistoryReader,
    private maxHistoryMessages: number,
  ) {}

  buildSystemPrompt(): string {
    const { soul, user, agents } = this.bootstrap.load();

    const sections: string[] = [];
    if (soul) sections.push(soul);
    if (user) sections.push(user);
    if (agents) sections.push(agents);

    return sections.join("\n\n---\n\n");
  }

  async buildMessages(
    sessionId: string,
    userMessage: string,
  ): Promise<AgentMessage[]> {
    const history = await this.sessionManager.getHistory(
      sessionId,
      this.maxHistoryMessages,
    );

    return [...history, { role: "user" as const, content: userMessage }];
  }
}
