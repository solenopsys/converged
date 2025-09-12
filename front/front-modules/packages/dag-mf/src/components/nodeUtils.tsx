import { NODE_TYPE_MAP, NODE_DESCRIPTION_MAP, DEFAULT_NODE_TYPE, DEFAULT_NODE_DESCRIPTION } from './nodeConfig';

interface WorkflowConfig {
  nodes: Record<string, string>;
  links: Record<string, string>;
}

export const createNodeMap = (config: WorkflowConfig): Map<string, string[]> => {
  const nodeMap = new Map<string, string[]>();
  
  // Инициализируем все узлы
  Object.keys(config.nodes).forEach(nodeName => {
    nodeMap.set(nodeName, []);
  });
  
  // Заполняем связи
  Object.entries(config.links).forEach(([fromNode, toNode]) => {
    if (nodeMap.has(fromNode)) {
      const connections = nodeMap.get(fromNode)!;
      connections.push(toNode);
    }
  });
  
  return nodeMap;
};

export const getNodeType = async (nodeName: string): Promise<string> => {
  return NODE_TYPE_MAP[nodeName] || DEFAULT_NODE_TYPE;
};

export const getNodeDescription = async (nodeName: string): Promise<string> => {
  return NODE_DESCRIPTION_MAP[nodeName] || DEFAULT_NODE_DESCRIPTION;
};