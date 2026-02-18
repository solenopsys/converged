import type { INode } from "../dag-api";
import type { DagRegistry } from "../registry";

export type NodeCallInfo = {
  nodeType: string;
  nodeName: string;
  config: Record<string, any>;
};

export type NodeInjections = {
  provider?: any;
  persistent?: any;
};

export function createNodeFromCall(
  call: NodeCallInfo,
  registry: DagRegistry,
  injections?: NodeInjections,
): INode {
  const definition = registry.getNodeDefinition(call.nodeType);
  if (!definition) {
    throw new Error(`Node type not registered: ${call.nodeType}`);
  }

  const params = definition.params.map((param) => {
    if (param.name === "name") {
      return call.nodeName;
    }
    return call.config?.[param.name];
  });

  const node = Reflect.construct(definition.ctor, params);

  // Inject provider if configured
  if (call.config?.provider) {
    const provider = registry.getProviderInstance(call.config.provider);
    if (provider && "provider" in node) {
      node.provider = provider;
    }
  }

  // Inject persistent if node has it
  if (injections?.persistent && "persistent" in node) {
    node.persistent = injections.persistent;
  }

  return node;
}
