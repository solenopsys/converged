




interface WorkflowEvent {
	id: string;
	scope?: string;
	parentId?: string;
	sourceNodeName?: string;
	timestamp: Date;
}

interface ProcessNode {
	name: string;
	scope?: string;
	onEvent(dataId: string, sourceNodeName?: string | undefined): Promise<string>;
}

export interface BaseNodeConfig {
	params?: Record<string, unknown>;
}

export interface ContextAccessor {
	getFrom(data: any, key: string): any;
}

export interface INode {
	name: string;
	params?: Record<string, unknown>;
	execute(data: unknown, accessor: ContextAccessor): Promise<unknown>;
}

// Исправлено: убрал string из пересечения типов
export type NodeConstructor = new (
	config: { name: string } & BaseNodeConfig,
) => INode;

export type NodeMap = Record<string, NodeConstructor>;

export interface WorkflowJson {
	nodes: Record<string, BaseNodeConfig>;
	connections: Record<string, string[]>;
}

export interface WorkflowConfig {
	nodes: Map<string, BaseNodeConfig>; // Исправлено: BaseNodeConfig вместо INode
	connections: Map<string, string[]>;
}

export type {
	ProcessNode,
	WorkflowEvent,
};
