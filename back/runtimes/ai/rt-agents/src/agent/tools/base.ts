export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: Record<string, unknown>): Promise<string>;
}

export function toolToFunctionDefinition(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}
