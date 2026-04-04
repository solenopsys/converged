export const NODE_TYPE_MAP: Record<string, string> = {
  'start': 'play',
  'get_object': 'database',
  'get_template_types': 'file',
  'get_sender': 'user',
  'ai_select_template_type': 'brain',
  'select_one_template_by_type': 'filter',
  'templateInjectorFooter': 'type',
  'templateInjectorBody': 'edit',
  'templateInjectorSubject': 'mail',
  'randomStringN': 'shuffle',
  'convertHtmlN': 'code',
  'insert_mail': 'send'
};



export const DEFAULT_NODE_TYPE = 'circle';
export const DEFAULT_NODE_DESCRIPTION = 'Описание недоступно';

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

 