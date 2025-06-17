// workflow-loader.ts - исправлено только возвращаемое значение loadNodes
import type {
	NodeMap,
	BaseNodeConfig,
	WorkflowJson,
	WorkflowConfig,
} from "./types";

export class WorkflowLoader {
	constructor(private readonly nodeMap: NodeMap) {}

	// Исправлено: возвращаем Map<string, BaseNodeConfig> вместо Map<string, INode>
	private loadNodes(
		source: Record<string, BaseNodeConfig>,
	): Map<string, BaseNodeConfig> {
		const result = new Map<string, BaseNodeConfig>();

		for (const [id, cfg] of Object.entries(source)) {
			const NodeClass = this.nodeMap[cfg.type];
			if (!NodeClass) throw new Error(`Unknown node type: ${cfg.type}`);
			result.set(id, cfg); // Сохраняем конфиг, а не инстанс
		}

		return result;
	}

	private loadConnections(
		source: Record<string, string[]>,
		nodes: Map<string, BaseNodeConfig>, // Исправлено: BaseNodeConfig вместо INode
	): Map<string, string[]> {
		const result = new Map<string, string[]>();

		for (const [from, to] of Object.entries(source)) {
			if (!nodes.has(from)) throw new Error(`Unknown source node: ${from}`);
			to.forEach((id) => {
				if (!nodes.has(id)) throw new Error(`Unknown target node: ${id}`);
			});
			result.set(from, to);
		}

		this.ensureAcyclic(result);

		return result;
	}

	private ensureAcyclic(graph: Map<string, string[]>): void {
		const visited = new Set<string>();
		const stack = new Set<string>();

		const dfs = (node: string): void => {
			if (stack.has(node)) throw new Error(`Cycle detected at: ${node}`);
			if (visited.has(node)) return;
			visited.add(node);
			stack.add(node);
			(graph.get(node) || []).forEach(dfs);
			stack.delete(node);
		};

		[...graph.keys()].forEach(dfs);
	}

	load(json: WorkflowJson): WorkflowConfig {
		const nodes = this.loadNodes(json.nodes);
		const connections = this.loadConnections(json.connections, nodes);
		return { nodes, connections };
	}
}
