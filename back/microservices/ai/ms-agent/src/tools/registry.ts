import type { Tool } from "./base";
import { toolToFunctionDefinition } from "./base";
import type { ToolCallRequest, ToolCallResult } from "../core/types";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getFunctionDefinitions() {
    return this.list().map(toolToFunctionDefinition);
  }

  async executeBatch(calls: ToolCallRequest[]): Promise<ToolCallResult[]> {
    return Promise.all(calls.map((call) => this.execute(call)));
  }

  async execute(call: ToolCallRequest): Promise<ToolCallResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        id: call.id,
        name: call.name,
        result: `Error: Tool "${call.name}" not found. Available: ${Array.from(this.tools.keys()).join(", ")}`,
        isError: true,
      };
    }

    try {
      const result = await tool.execute(call.args);
      return {
        id: call.id,
        name: call.name,
        result: typeof result === "string" ? result : JSON.stringify(result),
        isError: false,
      };
    } catch (error: any) {
      return {
        id: call.id,
        name: call.name,
        result: `Error executing "${call.name}": ${error.message}`,
        isError: true,
      };
    }
  }
}
